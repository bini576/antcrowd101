export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid #e5e7eb', padding: '1rem 2rem', marginTop: '2rem' }}>
      <small>© {new Date().getFullYear()} AntCrowd</small>
    </footer>
  );
}
