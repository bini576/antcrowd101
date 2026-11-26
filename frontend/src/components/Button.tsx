type ButtonProps = {
  label: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
};

export default function Button({ label, onClick, type = 'button' }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      style={{
        background: '#2563eb',
        color: '#fff',
        border: 0,
        borderRadius: '8px',
        padding: '0.6rem 1rem',
        cursor: 'pointer'
      }}
    >
      {label}
    </button>
  );
}
