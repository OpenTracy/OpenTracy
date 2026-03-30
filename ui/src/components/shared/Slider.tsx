import { Slider as ShadcnSlider } from '@/components/ui/slider';

interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function Slider({ label, value, onChange, min = 0, max = 100, step = 1 }: SliderProps) {
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        {label && <label className="text-sm font-medium text-foreground">{label}</label>}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-16 px-2 py-1 text-sm bg-surface border border-border text-foreground rounded-lg hover:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-transparent"
          min={min}
          max={max}
          step={step}
        />
      </div>
      <ShadcnSlider
        value={[value]}
        onValueChange={(values) => onChange(values[0])}
        min={min}
        max={max}
        step={step}
      />
    </div>
  );
}

export default Slider;
