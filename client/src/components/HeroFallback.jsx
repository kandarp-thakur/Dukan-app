const PANELS = [
    { label: 'Sales', value: '₹1,150', top: '6%', left: '2%', rotate: -8, width: 40 },
    { label: 'Expenses', value: '₹860', top: '34%', left: '40%', rotate: 4, width: 60 },
    { label: 'Profit', value: '₹290', top: '62%', left: '10%', rotate: -3, width: 80 },
];

export default function HeroFallback() {
    return (
        <div data-testid="hero-fallback" aria-hidden="true" className="hero-3d relative h-full w-full">
            {PANELS.map((panel, index) => (
                <div
                    key={panel.label}
                    className="glass-card absolute w-40 p-3"
                    style={{
                        top: panel.top,
                        left: panel.left,
                        transform: `rotateY(${panel.rotate}deg) translateZ(${index * 24}px)`,
                    }}
                >
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{panel.label}</p>
                    <p className="mt-1 text-xl font-bold text-primary">{panel.value}</p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-white/70">
                        <div
                            className="h-1.5 rounded-full bg-gradient-to-r from-primary to-accent"
                            style={{ width: `${panel.width}%` }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}
