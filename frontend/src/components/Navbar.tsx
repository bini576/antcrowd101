import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Platform' },
  { to: '/solutions', label: 'Solution' },
  { to: '/partners', label: 'Partners' },
  { to: '/researchers', label: 'Researchers' },
  { to: '/company', label: 'Company' }
];

export default function Navbar() {
  return (
    <header style={{ borderBottom: '1px solid #e5e7eb', padding: '1rem 2rem' }}>
      <nav style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <strong>AntCrowd</strong>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            style={({ isActive }) => ({
              color: isActive ? '#2563eb' : '#374151',
              textDecoration: 'none',
              fontWeight: isActive ? 700 : 500
            })}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
