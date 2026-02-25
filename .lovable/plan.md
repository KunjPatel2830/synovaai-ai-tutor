

## Diagnosis

After thorough investigation, I found **three distinct root causes** for why both upload modes are failing:

### Problem 1: Study Materials INSERT blocked by RLS
The `StudyMaterialUploader` tries to insert into `study_pdfs` using the Lovable Cloud `supabase` client. However, the user is authenticated on the **external** Supabase project, so `auth.uid()` is null in Lovable Cloud context. All RLS policies on `study_pdfs` are RESTRICTIVE with no PERMISSIVE INSERT policy for unauthenticated users. Result: INSERT fails with "Could not find table" or "Unknown error".

### Problem 2: PYQ INSERT may fail due to RLS mismatch
The `PYQUploader` inserts into `pyq_uploads` via `externalSupabase`, which should work. But the error "Failed to send a request to the Edge Function" and timeouts suggest the large base64 payload combined with the two-step process (insert record, then call edge function) creates fragile sequencing.

### Problem 3: Incomplete CORS headers on edge functions
Both edge functions use a minimal CORS header set missing `x-supabase-client-platform` and related headers that the JS SDK sends.

---

## Fix Plan

### 1. Move ALL database writes into edge functions (both modes)

Instead of the client creating a DB record first and then calling the edge function, the client will send everything directly to the edge function. The edge function (using service role key) will handle record creation AND processing. This eliminates RLS issues entirely.

**`StudyMaterialUploader.tsx`**: Remove the `supabase.from("study_pdfs").insert(...)` step. Send subject, chapter, fileName, pdfBase64, and teacherId directly to `process-study-pdf`. The edge function creates the `study_pdfs` record itself.

**`PYQUploader.tsx`**: Remove the `externalSupabase.from("pyq_uploads").insert(...)` step. Send examType, year, shift, fileName, pdfBase64, and userId directly to `parse-pyq-pdf`. The edge function creates the `pyq_uploads` record itself.

### 2. Update edge functions to create records internally

**`process-study-pdf/index.ts`**:
- Accept `fileName` in addition to existing params
- Create the `study_pdfs` record at the start (using service role)
- Return the created `pdfId` in the response

**`parse-pyq-pdf/index.ts`**:
- Accept `fileName` in addition to existing params  
- Create the `pyq_uploads` record at the start (using service role)
- Return the created `uploadId` in the response

### 3. Fix CORS headers on both edge functions

Update both to include the full required header set:
```
authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version
```

### 4. Fix PYQUploadHistory retry and StudyMaterialManager reads

- `PYQUploadHistory.tsx`: The retry uses `supabase.functions.invoke` directly instead of `invokeBackendFunction`. Switch it to use `invokeBackendFunction` with proper timeout for consistency.
- `StudyMaterialManager.tsx`: Reads remain via `supabase` client (Lovable Cloud) since the SELECT RLS policies allow public reads.
- `StudentStudyMaterials.tsx`: Same - reads remain via `supabase` client.

### 5. Re-deploy both edge functions

After updating the code, both `parse-pyq-pdf` and `process-study-pdf` will be re-deployed automatically.

---

### Technical Summary

```text
BEFORE (broken):
  Client ──INSERT──> DB (fails: RLS / wrong auth context)
  Client ──POST───> Edge Function (processes PDF, writes results)

AFTER (fixed):
  Client ──POST───> Edge Function (creates record + processes PDF + writes results)
  Client ──SELECT──> DB (reads only, allowed by public SELECT policies)
```

Files to modify:
- `supabase/functions/parse-pyq-pdf/index.ts` (CORS + create record internally)
- `supabase/functions/process-study-pdf/index.ts` (CORS + create record internally)
- `src/components/exam/PYQUploader.tsx` (remove client-side INSERT)
- `src/components/exam/StudyMaterialUploader.tsx` (remove client-side INSERT)
- `src/components/exam/PYQUploadHistory.tsx` (fix retry to use invokeBackendFunction)

