import React from 'react';

const CookiePolicy: React.FC = () => {
  const h2Style: React.CSSProperties = {
    color: '#38bdf8',
    fontSize: '1.1rem',
    marginTop: '2rem',
    marginBottom: '0.5rem',
    borderBottom: '1px solid #1e293b',
    paddingBottom: '0.25rem',
  };

  const pStyle: React.CSSProperties = {
    color: '#94a3b8',
    lineHeight: '1.7',
    marginBottom: '0.75rem',
  };

  const contactBox: React.CSSProperties = {
    background: '#1e293b',
    borderLeft: '3px solid #38bdf8',
    padding: '1rem 1.25rem',
    borderRadius: '4px',
    margin: '1rem 0',
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '1rem',
    fontSize: '0.875rem',
  };

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    color: '#cbd5e1',
    background: '#1e293b',
    padding: '0.6rem 0.75rem',
    borderBottom: '1px solid #334155',
  };

  const tdStyle: React.CSSProperties = {
    color: '#94a3b8',
    padding: '0.6rem 0.75rem',
    borderBottom: '1px solid #1e293b',
    verticalAlign: 'top',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <a href="/" style={{ color: '#38bdf8', fontSize: '0.9rem', textDecoration: 'none' }}>← Volver</a>
        <h1 style={{ color: '#f8fafc', fontSize: '2rem', margin: '1rem 0 0.25rem' }}>Política de Cookies</h1>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '2rem' }}>Última actualización: junio 2025</p>

        <h2 style={h2Style}>1. ¿Qué son las cookies?</h2>
        <p style={pStyle}>
          Las cookies son pequeños ficheros de texto que los sitios web depositan en el navegador del usuario cuando
          este los visita. Permiten que el sitio recuerde información sobre su visita, como el idioma preferido y otras
          opciones, con el fin de facilitar su próxima visita y hacer que el sitio le resulte más útil.
        </p>
        <p style={pStyle}>
          El uso de cookies puede implicar el tratamiento de datos personales. Triskell Gate aplica las disposiciones
          del RGPD y la Ley 34/2002, de Servicios de la Sociedad de la Información y Comercio Electrónico (LSSI-CE),
          en materia de cookies.
        </p>

        <h2 style={h2Style}>2. Cookies Esenciales</h2>
        <p style={pStyle}>
          Estas cookies son imprescindibles para el funcionamiento de la plataforma. Sin ellas, el servicio no puede
          prestarse correctamente. No pueden desactivarse y no requieren su consentimiento previo, ya que su uso se
          ampara en la base legal de ejecución del contrato (art. 6.1.b RGPD).
        </p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Nombre</th>
              <th style={thStyle}>Finalidad</th>
              <th style={thStyle}>Duración</th>
              <th style={thStyle}>Proveedor</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}><code style={{ color: '#7dd3fc' }}>sb-access-token</code></td>
              <td style={tdStyle}>Token de sesión de usuario. Autentica las peticiones a la API.</td>
              <td style={tdStyle}>Duración de la sesión del navegador</td>
              <td style={tdStyle}>Supabase, Inc.</td>
            </tr>
            <tr>
              <td style={tdStyle}><code style={{ color: '#7dd3fc' }}>sb-refresh-token</code></td>
              <td style={tdStyle}>Token de refresco de sesión. Permite renovar el token de acceso sin requerir nuevo inicio de sesión.</td>
              <td style={tdStyle}>1 año</td>
              <td style={tdStyle}>Supabase, Inc.</td>
            </tr>
          </tbody>
        </table>

        <h2 style={h2Style}>3. Cookies Funcionales</h2>
        <p style={pStyle}>
          Las cookies funcionales mejoran la experiencia de uso de la plataforma recordando sus preferencias y
          configuraciones. Su uso es opcional, aunque su desactivación puede afectar a algunas funcionalidades.
        </p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Nombre</th>
              <th style={thStyle}>Finalidad</th>
              <th style={thStyle}>Duración</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}><code style={{ color: '#7dd3fc' }}>tg-ui-prefs</code></td>
              <td style={tdStyle}>Almacena preferencias de interfaz de usuario (por ejemplo, idioma o ajustes de visualización).</td>
              <td style={tdStyle}>1 año</td>
            </tr>
          </tbody>
        </table>

        <h2 style={h2Style}>4. Cookies Analíticas</h2>
        <p style={pStyle}>
          Las cookies analíticas recopilan información agregada y anónima sobre el uso de la plataforma, con el
          fin de mejorar su rendimiento y contenidos. Solo se activan con su consentimiento explícito (opt-in).
        </p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Finalidad</th>
              <th style={thStyle}>Tipo de datos</th>
              <th style={thStyle}>Base legal</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>Estadísticas anónimas de uso: páginas visitadas, tiempo de sesión, rutas de navegación.</td>
              <td style={tdStyle}>Datos agregados, sin identificación personal.</td>
              <td style={tdStyle}>Consentimiento (art. 6.1.a RGPD)</td>
            </tr>
          </tbody>
        </table>
        <p style={pStyle}>
          Puede retirar su consentimiento para las cookies analíticas en cualquier momento a través del panel
          de gestión de cookies disponible en la plataforma, sin que ello afecte a la licitud del tratamiento
          basado en el consentimiento previo a su retirada.
        </p>

        <h2 style={h2Style}>5. Gestión de Cookies</h2>
        <p style={pStyle}>
          Puede configurar su navegador para aceptar, rechazar o eliminar las cookies. Tenga en cuenta que
          deshabilitar las cookies esenciales puede impedir el correcto funcionamiento de la plataforma.
          A continuación encontrará instrucciones para los principales navegadores:
        </p>
        <ul style={{ color: '#94a3b8', lineHeight: '2', paddingLeft: '1.5rem', marginBottom: '0.75rem' }}>
          <li>
            <strong style={{ color: '#cbd5e1' }}>Google Chrome:</strong>{' '}
            Configuración → Privacidad y seguridad → Cookies y otros datos de sitios.
          </li>
          <li>
            <strong style={{ color: '#cbd5e1' }}>Mozilla Firefox:</strong>{' '}
            Menú → Preferencias → Privacidad y seguridad → Cookies y datos del sitio.
          </li>
          <li>
            <strong style={{ color: '#cbd5e1' }}>Apple Safari:</strong>{' '}
            Preferencias → Privacidad → Gestionar datos de sitios web.
          </li>
          <li>
            <strong style={{ color: '#cbd5e1' }}>Microsoft Edge:</strong>{' '}
            Configuración → Cookies y permisos del sitio → Cookies y datos del sitio.
          </li>
        </ul>
        <p style={pStyle}>
          Para más información sobre la gestión de cookies, puede consultar el sitio oficial de la AEPD:{' '}
          <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}>
            https://www.aepd.es
          </a>.
        </p>

        <h2 style={h2Style}>6. Contacto</h2>
        <p style={pStyle}>
          Para cualquier consulta relacionada con el uso de cookies en Triskell Gate, puede contactar con nosotros en:
        </p>
        <div style={contactBox}>
          <p style={{ ...pStyle, marginBottom: '0.25rem' }}>
            <strong style={{ color: '#e2e8f0' }}>X-Ops Alliance, S.L.</strong> — Madrid, España
          </p>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            📧 <a href="mailto:privacy@xopsalliance.com" style={{ color: '#38bdf8' }}>privacy@xopsalliance.com</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default CookiePolicy;
