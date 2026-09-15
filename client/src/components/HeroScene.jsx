import { Canvas } from '@react-three/fiber';
import { Float, RoundedBox } from '@react-three/drei';

function PanelRows({ y = 0 }) {
    return (
        <>
            <mesh position={[0.32, y + 0.22, 0.05]}>
                <boxGeometry args={[0.8, 0.05, 0.01]} />
                <meshStandardMaterial color="#2E7D32" />
            </mesh>
            <mesh position={[0.17, y + 0.02, 0.05]}>
                <boxGeometry args={[0.5, 0.05, 0.01]} />
                <meshStandardMaterial color="#4CAF50" />
            </mesh>
        </>
    );
}

function Panel({ position, rotation, scale, children }) {
    return (
        <Float speed={1.1} rotationIntensity={0.25} floatIntensity={0.5}>
            <group position={position} rotation={rotation} scale={scale}>
                <RoundedBox args={[1.6, 1, 0.06]} radius={0.05} smoothness={4}>
                    <meshPhysicalMaterial
                        color="#ffffff"
                        transparent
                        opacity={0.55}
                        roughness={0.15}
                        metalness={0}
                        transmission={0.4}
                        thickness={0.6}
                    />
                </RoundedBox>
                {children}
            </group>
        </Float>
    );
}

export default function HeroScene() {
    return (
        <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0, 4], fov: 45 }}>
            <ambientLight intensity={0.8} />
            <directionalLight position={[3, 4, 5]} intensity={1.1} />
            <directionalLight position={[-4, -1, 2]} intensity={0.5} color="#4CAF50" />
            <Panel position={[-0.7, 0.3, 0]} rotation={[0, 0.3, 0]} scale={1}>
                <PanelRows />
            </Panel>
            <Panel position={[0.7, -0.1, -0.4]} rotation={[0, -0.35, 0]} scale={0.9}>
                <PanelRows y={-0.05} />
            </Panel>
            <Panel position={[0, -0.7, -0.8]} rotation={[0.1, 0, 0]} scale={0.8}>
                <PanelRows />
            </Panel>
        </Canvas>
    );
}
