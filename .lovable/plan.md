# Fix the BadgeCard "Function components cannot be given refs" warning

## What's happening

The warning fires because `BadgeCard` is rendered inside Radix UI primitives (`Tabs`, `TabsContent`, `Dialog`, `ScrollArea`) in `BadgesDisplay.tsx`. Some of those primitives forward a ref down to their direct children for measurement/focus management, but `BadgeCard` is a plain function component and cannot receive a ref. React logs the warning once per render of each `BadgeCard`, which is why you see it firing many times (one per rendered badge in the grid and the dialog).

Despite the noisy log, nothing visually breaks — so this is a clean-up, not a feature regression.

## The fix

Convert `src/components/badges/BadgeCard.tsx` from a plain `function` component to one created with `React.forwardRef`, and attach the forwarded ref to the top-level `<div>` of both render branches (compact and full).

### File to change

- `src/components/badges/BadgeCard.tsx`

### Edits

1. Add `forwardRef` to the existing React import line.
2. Replace `export function BadgeCard({ ... }: BadgeCardProps) {` with:
   ```
   export const BadgeCard = forwardRef<HTMLDivElement, BadgeCardProps>(
     function BadgeCard({ ...props }, ref) { ... }
   );
   ```
3. Add `ref={ref}` to the outer `<div>` in the `compact` branch (around line 62).
4. Add `ref={ref}` to the outer `<div>` in the default branch (around line 93).

No other call site needs to change — `BadgesDisplay.tsx` keeps rendering `<BadgeCard ... />` exactly as before.

## Quick audit for other components

Other custom function components (e.g. `JoinWithCode`, `TeacherChatWidget`, etc.) are rendered as plain children of layout `div`s, not directly inside Radix primitives that forward refs, so they don't trigger this warning today. If a similar warning appears later for another component, the same `forwardRef` wrap is the fix.

## Expected result

- The console warning chain rooted at `BadgeCard` disappears.
- Badges still render identically in the dashboard grid and the "View All" dialog.
- No behavior change anywhere else.
