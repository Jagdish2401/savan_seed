import { BarChart2, Plus, Trash2 } from 'lucide-react';

export default function TemplateTab({
  busy,
  newProduct,
  setNewProduct,
  handleAddItemToCombined,
  templateProducts,
  handleDeleteProduct,
}) {
  return (
    <div className="fade-in">
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '2rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--primary), #3b82f6)',
            color: 'white',
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.75rem',
            boxShadow: '0 8px 16px rgba(59, 130, 246, 0.25)'
          }}>
            <Plus size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, color: 'var(--text)' }}>
              Add Product
            </h2>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-light)', margin: '0.25rem 0 0 0' }}>
              Manage the products and price configurations in your Combined Excel templates.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', alignItems: 'start' }}>
          {/* Add Product Form */}
          <div className="card" style={{ border: '1.5px solid var(--primary-soft)', background: 'rgba(22, 163, 74, 0.02)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Plus size={20} color="var(--primary)" /> Add New Product
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-light)' }}>Product Name</label>
                <input
                  className="input"
                  placeholder="e.g. Wheat, Mustard"
                  value={newProduct.productName}
                  onChange={(e) => setNewProduct(p => ({ ...p, productName: e.target.value }))}
                  style={{ borderRadius: '10px', height: '48px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-light)' }}>Min Price (NRV)</label>
                <input
                  className="input"
                  type="number"
                  placeholder="e.g. 1500"
                  value={newProduct.minPrice}
                  onChange={(e) => setNewProduct(p => ({ ...p, minPrice: e.target.value }))}
                  style={{ borderRadius: '10px', height: '48px' }}
                />
              </div>
              <button
                onClick={() => handleAddItemToCombined('all')}
                disabled={busy || !newProduct.productName || !newProduct.minPrice}
                className="btn btn-primary"
                style={{ height: '48px', borderRadius: '10px', fontWeight: '700' }}
              >
                Add to All Master Templates
              </button>
            </div>
          </div>

          {/* Current Products List */}
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <BarChart2 size={20} color="var(--primary)" /> Active Products (Shared)
            </h3>
            <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {templateProducts.length > 0 ? (
                templateProducts.map(prod => (
                  <div
                    key={prod.name}
                    style={{
                      padding: '1rem',
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '700', color: 'var(--text)' }}>{prod.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>NRV: ₹{prod.minPrice}</div>
                    </div>
                    <button
                      onClick={() => handleDeleteProduct(prod.name, 'all')}
                      disabled={busy}
                      className="btn btn-secondary"
                      style={{
                        width: '36px', height: '36px', padding: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)'
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-light)' }}>
                  No products found in the shared layout.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
