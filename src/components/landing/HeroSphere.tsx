import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

function AnimatedSphere() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock, pointer }) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = clock.getElapsedTime() * 0.15 + pointer.y * 0.3;
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.2 + pointer.x * 0.3;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.4} floatIntensity={1.5}>
      <mesh ref={meshRef} scale={2.2}>
        <icosahedronGeometry args={[1, 4]} />
        <MeshDistortMaterial
          color="#7c3aed"
          roughness={0.2}
          metalness={0.8}
          distort={0.35}
          speed={2}
          transparent
          opacity={0.85}
        />
      </mesh>
    </Float>
  );
}

function OrbitingNodes() {
  const groupRef = useRef<THREE.Group>(null);
  const nodes = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 2;
      const radius = 3 + Math.random() * 0.5;
      return {
        position: [
          Math.cos(angle) * radius,
          (Math.random() - 0.5) * 2,
          Math.sin(angle) * radius,
        ] as [number, number, number],
        scale: 0.06 + Math.random() * 0.08,
        speed: 0.3 + Math.random() * 0.5,
      };
    });
  }, []);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.getElapsedTime() * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      {nodes.map((node, i) => (
        <mesh key={i} position={node.position} scale={node.scale}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial
            color={i % 3 === 0 ? "#a78bfa" : i % 3 === 1 ? "#34d399" : "#60a5fa"}
            emissive={i % 3 === 0 ? "#a78bfa" : i % 3 === 1 ? "#34d399" : "#60a5fa"}
            emissiveIntensity={0.5}
          />
        </mesh>
      ))}
    </group>
  );
}

function ConnectionLines() {
  const linesRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (linesRef.current) {
      linesRef.current.rotation.y = clock.getElapsedTime() * 0.05;
      linesRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.2) * 0.1;
    }
  });

  const lines = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const angle1 = (i / 6) * Math.PI * 2;
      const angle2 = ((i + 2) / 6) * Math.PI * 2;
      const r = 3;
      const points = [
        new THREE.Vector3(Math.cos(angle1) * r, (Math.random() - 0.5) * 2, Math.sin(angle1) * r),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(Math.cos(angle2) * r, (Math.random() - 0.5) * 2, Math.sin(angle2) * r),
      ];
      return new THREE.CatmullRomCurve3(points).getPoints(20);
    });
  }, []);

  return (
    <group ref={linesRef}>
      {lines.map((points, i) => (
        <line key={i}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              array={new Float32Array(points.flatMap((p) => [p.x, p.y, p.z]))}
              count={points.length}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#a78bfa" transparent opacity={0.15} />
        </line>
      ))}
    </group>
  );
}

export function HeroSphere() {
  return (
    <div className="w-full h-[300px] sm:h-[400px] lg:h-[500px]">
      <Canvas
        camera={{ position: [0, 0, 7], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <pointLight position={[-5, -5, -5]} intensity={0.5} color="#a78bfa" />
        <pointLight position={[5, -3, 2]} intensity={0.3} color="#34d399" />
        <AnimatedSphere />
        <OrbitingNodes />
        <ConnectionLines />
      </Canvas>
    </div>
  );
}
