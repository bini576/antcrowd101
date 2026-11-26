import Card from '../components/Card';
// Page: Products

export default function Products() {
  // Page layout.
  const products = [
    { title: 'Trust Center', description: 'Publish and manage trust content for stakeholders.' },
    { title: 'GRC Hub', description: 'Centralize governance, risk, and compliance operations.' },
    { title: 'Policy Manager', description: 'Track internal controls and policy lifecycle.' }
  ];

  return (
    <>
    {/* Content section. */}
    <section>
      <h1>Products</h1>
      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {products.map((product) => (
          <Card key={product.title} title={product.title} description={product.description} />
        ))}
      </div>
    </section>
  </>
  );
}
