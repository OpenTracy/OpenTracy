type Props = {
  label: string;
  value: string;
};

export const InfoRow = ({ label, value }: Props) => (
  <div className="flex justify-between text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium truncate">{value}</span>
  </div>
);
