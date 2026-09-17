import { useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, RoundedBox } from '@react-three/drei';
import { MathUtils } from 'three';

function PanelRows({ y = 0 }) {
    return (
        <>
            <mesh position={[0.32, y + 0.22, 0.07]}>
                <boxGeometry args={[0.8, 0.05, 0.04]} />
                <meshStandardMaterial color="#C2410C" roughness={0.35} metalness={0.05} />
            </mesh>
            <mesh position={[0.17, y + 0.02, 0.07]}>
                <boxGeometry args={[0.5, 0.05, 0.04]} />
                <meshStandardMaterial color="#F97316" roughness={0.35} metalness={0.05} />
            </mesh>
        </>
    );
}

function Panel({ position, rotation, scale, children }) {
    return (
        <Float speed={1.1} rotationIntensity={0.35} floatIntensity={0.7}>
            <group position={position} rotation={rotation} scale={scale}>
                <RoundedBox args={[1.6, 1, 0.14]} radius={0.06} smoothness={4}>
                    <meshStandardMaterial
                        color="#ffffff"
                        transparent
                        opacity={0.7}
                        roughness={0.2}
                        metalness={0.05}
                    />
                </RoundedBox>
                {children}
            </group>
        </Float>
    );
}

// Tilts the whole panel cluster toward the pointer every frame. This is the
// interactive depth cue (spec §6.1): without it the fixed camera reads flat.
function Rig({ children }) {
    const ref = useRef();

    useFrame((state, delta) => {
        if (!ref.current) return;
        const { x, y } = state.pointer;
        ref.current.rotation.y = MathUtils.damp(ref.current.rotation.y, x * 0.45, 3, delta);
        ref.current.rotation.x = MathUtils.damp(ref.current.rotation.x, 0.1 - y * 0.3, 3, delta);
    });

    return (
        <group ref={ref} rotation={[0.1, 0, 0]}>
            {children}
        </group>
    );
}

/**
 * WebGL context-loss recovery.
 *
 * A WebGL context is a scarce, low-priority GPU resource. A canvas that draws
 * every frame and is never paused is the first candidate a browser or driver
 * reclaims under memory pressure -- after which the canvas stays blank, or
 * renders with no shading, until the page is reloaded. That is a silent
 * failure: the canvas element remains in the DOM and keeps its CSS size, so
 * the panel geometry still occupies its place but reads flat.
 *
 * Two defences, both required by spec §6.3:
 *   - `frameloop` stops drawing when the hero is offscreen or the tab is
 *     hidden, which removes the reason to reclaim the context at all;
 *   - a `webglcontextlost` listener reports the loss upward so the owner can
 *     swap in the static `HeroFallback` instead of showing a dead canvas.
 */
export default function HeroScene({ active = true, onContextLost }) {
    const cleanupRef = useRef(null);
    const onContextLostRef = useRef(onContextLost);

    useEffect(() => {
        onContextLostRef.current = onContextLost;
    }, [onContextLost]);

    // Detach the listener if the canvas unmounts before the context is lost.
    useEffect(
        () => () => {
            if (cleanupRef.current) cleanupRef.current();
        },
        []
    );

    const handleCreated = ({ gl }) => {
        const domElement = gl && gl.domElement;
        if (!domElement) return;

        const handleContextLost = (event) => {
            // Without preventDefault the browser will not attempt restoration
            // and the canvas is permanently dead.
            event.preventDefault();
            if (typeof onContextLostRef.current === 'function') onContextLostRef.current();
        };

        domElement.addEventListener('webglcontextlost', handleContextLost);
        cleanupRef.current = () => domElement.removeEventListener('webglcontextlost', handleContextLost);
    };

    return (
        <Canvas
            dpr={[1, 1.75]}
            frameloop={active ? 'always' : 'never'}
            camera={{ position: [0, 0, 4.2], fov: 50 }}
            onCreated={handleCreated}
        >
            <ambientLight intensity={0.45} />
            <directionalLight position={[3, 4, 5]} intensity={1.6} />
            <directionalLight position={[-4, -1, 2]} intensity={0.7} color="#F97316" />
            <pointLight position={[0, 2, 3]} intensity={0.6} color="#C2410C" />
            <Rig>
                <Panel position={[-0.75, 0.35, 0.6]} rotation={[0, 0.45, 0]} scale={1}>
                    <PanelRows />
                </Panel>
                <Panel position={[0.8, -0.05, -0.5]} rotation={[0, -0.5, 0]} scale={0.92}>
                    <PanelRows y={-0.05} />
                </Panel>
                <Panel position={[0, -0.75, -1.4]} rotation={[0.16, 0.1, 0]} scale={0.8}>
                    <PanelRows />
                </Panel>
            </Rig>
        </Canvas>
    );
}
