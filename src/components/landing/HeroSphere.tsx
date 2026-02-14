import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

function AnimatedSphere() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock, pointer }) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = clock.getElapsedTime() * 0.15 + pointer.y * 0.4;
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.2 + pointer.x * 0.4;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={1.2}>
      <mesh ref={meshRef} scale={2.4}>
        <icosahedronGeometry args={[1, 4]} />
        <MeshDistortMaterial
          color="#c8956c"
          roughness={0.15}
          metalness={0.9}
          distort={0.3}
          speed={1.8}
          transparent
          opacity={0.9}
        />
      </mesh>
      {/* Inner glow core */}
      <mesh scale={1.2}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial
          color="#f5d5a0"
          emissive="#f5d5a0"
          emissiveIntensity={0.6}
          transparent
          opacity={0.3}
        />
      </mesh>
    </Float>
  );
}

function OrbitingNodes() {
  const groupRef = useRef<THREE.Group>(null);
  const nodes = useMemo(() => {
    const colors = ["#d4a574", "#7ecfb0", "#c4a0e8", "#f5d5a0", "#60a5fa", "#34d399"];
    return Array.from({ length: 14 }, (_, i) => {
      const angle = (i / 14) * Math.PI * 2;
      const radius = 3.2 + Math.random() * 0.6;
      return {
        position: [
          Math.cos(angle) * radius,
          (Math.random() - 0.5) * 2.5,
          Math.sin(angle) * radius,
        ] as [number, number, number],
        scale: 0.05 + Math.random() * 0.1,
        color: colors[i % colors.length],
      };
    });
  }, []);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.getElapsedTime() * 0.08;
    }
  });

  return (
    <group ref={groupRef}>
      {nodes.map((node, i) => (
        <mesh key={i} position={node.position} scale={node.scale}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial
            color={node.color}
            emissive={node.color}
            emissiveIntensity={0.8}
          />
        </mesh>
      ))}
    </group>
  );
}

function OrbitalRings() {
  const ringRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (ringRef.current) {
      ringRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.3) * 0.2 + 0.5;
      ringRef.current.rotation.y = clock.getElapsedTime() * 0.05;
    }
  });

  return (
    <group ref={ringRef}>
      {[3.0, 3.6, 4.2].map((radius, i) => (
        <mesh key={i} rotation={[Math.PI / 2 + i * 0.3, i * 0.5, 0]}>
          <torusGeometry args={[radius, 0.008, 16, 100]} />
          <meshStandardMaterial
            color="#d4a574"
            emissive="#d4a574"
            emissiveIntensity={0.3}
            transparent
            opacity={0.2 - i * 0.04}
          />
        </mesh>
      ))}
    </group>
  );
}

export function HeroSphere() {
  return (
    <div className="w-full h-[300px] sm:h-[400px] lg:h-[500px]">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 42 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} color="#f5d5a0" />
        <pointLight position={[-4, -3, -4]} intensity={0.4} color="#c4a0e8" />
        <pointLight position={[4, -2, 3]} intensity={0.4} color="#7ecfb0" />
        <pointLight position={[0, 4, 0]} intensity={0.3} color="#f5d5a0" />
        <AnimatedSphere />
        <OrbitingNodes />
        <OrbitalRings />
      </Canvas>
    </div>
  );
}
