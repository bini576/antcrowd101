type FormFieldProps = {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
};

export default function FormField({ id, label, type = 'text', placeholder }: FormFieldProps) {
  return (
    <div style={{ display: 'grid', gap: '0.35rem', marginBottom: '0.75rem' }}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        placeholder={placeholder}
        style={{ padding: '0.55rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
      />
    </div>
  );
}
