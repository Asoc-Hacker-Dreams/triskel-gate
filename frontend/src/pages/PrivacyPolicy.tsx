import React from 'react';

const PrivacyPolicy: React.FC = () => {
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

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <a href="/" style={{ color: '#38bdf8', fontSize: '0.9rem', textDecoration: 'none' }}>← Volver</a>
        <h1 style={{ color: '#f8fafc', fontSize: '2rem', margin: '1rem 0 0.25rem' }}>Política de Privacidad</h1>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '2rem' }}>Última actualización: junio 2025</p>

        <h2 style={h2Style}>1. Responsable del Tratamiento</h2>
        <div style={contactBox}>
          <p style={{ ...pStyle, marginBottom: '0.25rem' }}><strong style={{ color: '#e2e8f0' }}>Empresa:</strong> X-Ops Alliance, S.L.</p>
          <p style={{ ...pStyle, marginBottom: '0.25rem' }}><strong style={{ color: '#e2e8f0' }}>Dirección:</strong> Madrid, España</p>
          <p style={{ ...pStyle, marginBottom: '0.25rem' }}><strong style={{ color: '#e2e8f0' }}>Email de contacto:</strong>{' '}
            <a href="mailto:privacy@xopsalliance.com" style={{ color: '#38bdf8' }}>privacy@xopsalliance.com</a>
          </p>
          <p style={{ ...pStyle, marginBottom: 0 }}><strong style={{ color: '#e2e8f0' }}>Delegado de Protección de Datos (DPD):</strong>{' '}
            <a href="mailto:dpo@xopsalliance.com" style={{ color: '#38bdf8' }}>dpo@xopsalliance.com</a>
          </p>
        </div>
        <p style={pStyle}>
          X-Ops Alliance, S.L. es el responsable del tratamiento de los datos personales recogidos a través de la
          plataforma Triskell Gate, conforme al Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018, de
          Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD).
        </p>

        <h2 style={h2Style}>2. Datos que Recopilamos</h2>
        <p style={pStyle}>En el marco de la prestación del servicio, tratamos las siguientes categorías de datos personales:</p>
        <ul style={{ color: '#94a3b8', lineHeight: '1.9', paddingLeft: '1.5rem', marginBottom: '0.75rem' }}>
          <li>Nombre completo y dirección de correo electrónico.</li>
          <li>Información de pago, procesada íntegramente por Stripe, Inc. No almacenamos en nuestros servidores ningún dato de tarjeta de crédito o débito.</li>
          <li>Historial de asistencia a eventos adquiridos a través de la plataforma.</li>
          <li>Códigos QR asociados a las entradas emitidas.</li>
          <li>Metadatos de autenticación (tokens de sesión y registros de acceso), gestionados por Supabase, Inc.</li>
        </ul>

        <h2 style={h2Style}>3. Encargados del Tratamiento (Sub-procesadores)</h2>
        <p style={pStyle}>
          Para la prestación del servicio, contamos con los siguientes encargados del tratamiento, todos ellos sujetos
          a acuerdos de tratamiento de datos (DPA) conformes al RGPD:
        </p>
        <div style={contactBox}>
          <p style={{ ...pStyle, marginBottom: '0.5rem' }}>
            <strong style={{ color: '#e2e8f0' }}>Stripe, Inc.</strong> — Procesamiento de pagos y gestión de transacciones.<br />
            Política de privacidad:{' '}
            <a href="https://stripe.com/es/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}>
              https://stripe.com/es/privacy
            </a>
          </p>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            <strong style={{ color: '#e2e8f0' }}>Supabase, Inc.</strong> — Autenticación de usuarios y almacenamiento de base de datos.<br />
            Política de privacidad:{' '}
            <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}>
              https://supabase.com/privacy
            </a>
          </p>
        </div>

        <h2 style={h2Style}>4. Finalidad y Base Legal del Tratamiento</h2>
        <p style={pStyle}>El tratamiento de sus datos se fundamenta en las siguientes bases legales previstas en el RGPD:</p>
        <ul style={{ color: '#94a3b8', lineHeight: '1.9', paddingLeft: '1.5rem', marginBottom: '0.75rem' }}>
          <li>
            <strong style={{ color: '#cbd5e1' }}>Art. 6.1.b RGPD — Ejecución de un contrato:</strong> gestión de su cuenta de usuario,
            procesamiento de la compra de entradas y validación de acceso a eventos.
          </li>
          <li>
            <strong style={{ color: '#cbd5e1' }}>Art. 6.1.c RGPD — Cumplimiento de obligación legal:</strong> conservación de registros
            financieros y contables conforme a la normativa fiscal española.
          </li>
          <li>
            <strong style={{ color: '#cbd5e1' }}>Art. 6.1.f RGPD — Interés legítimo:</strong> garantizar la seguridad e integridad de la
            plataforma y prevenir el fraude y el uso indebido del servicio.
          </li>
        </ul>

        <h2 style={h2Style}>5. Plazos de Conservación</h2>
        <ul style={{ color: '#94a3b8', lineHeight: '1.9', paddingLeft: '1.5rem', marginBottom: '0.75rem' }}>
          <li><strong style={{ color: '#cbd5e1' }}>Registros de pago y facturación:</strong> 7 años, conforme a la obligación legal fiscal española (Ley 58/2003 General Tributaria).</li>
          <li><strong style={{ color: '#cbd5e1' }}>Datos de eventos y asistencia:</strong> 2 años desde la fecha de celebración del evento.</li>
          <li><strong style={{ color: '#cbd5e1' }}>Datos de cuenta de usuario:</strong> durante la vigencia de la cuenta y hasta 30 días después de la solicitud de baja.</li>
        </ul>
        <p style={pStyle}>
          Transcurridos los plazos indicados, los datos serán suprimidos o anonimizados de forma irreversible.
        </p>

        <h2 style={h2Style}>6. Sus Derechos (Arts. 15–22 RGPD)</h2>
        <p style={pStyle}>
          En virtud del RGPD, usted tiene derecho a ejercer los siguientes derechos respecto al tratamiento de
          sus datos personales:
        </p>
        <ul style={{ color: '#94a3b8', lineHeight: '1.9', paddingLeft: '1.5rem', marginBottom: '0.75rem' }}>
          <li><strong style={{ color: '#cbd5e1' }}>Acceso (art. 15):</strong> conocer qué datos suyos tratamos y con qué finalidad.</li>
          <li><strong style={{ color: '#cbd5e1' }}>Rectificación (art. 16):</strong> corregir datos inexactos o incompletos.</li>
          <li><strong style={{ color: '#cbd5e1' }}>Supresión (art. 17):</strong> solicitar la eliminación de sus datos cuando ya no sean necesarios.</li>
          <li><strong style={{ color: '#cbd5e1' }}>Limitación del tratamiento (art. 18):</strong> restringir el uso de sus datos en determinadas circunstancias.</li>
          <li><strong style={{ color: '#cbd5e1' }}>Portabilidad (art. 20):</strong> recibir sus datos en formato estructurado y de uso común.</li>
          <li><strong style={{ color: '#cbd5e1' }}>Oposición (art. 21):</strong> oponerse al tratamiento basado en interés legítimo.</li>
        </ul>
        <p style={pStyle}>
          Para ejercer cualquiera de estos derechos, puede dirigirse a{' '}
          <a href="mailto:privacy@xopsalliance.com" style={{ color: '#38bdf8' }}>privacy@xopsalliance.com</a>.
          Responderemos a su solicitud en el plazo máximo de un mes.
        </p>
        <p style={pStyle}>
          Si considera que el tratamiento de sus datos vulnera la normativa vigente, tiene derecho a presentar
          una reclamación ante la <strong style={{ color: '#cbd5e1' }}>Agencia Española de Protección de Datos (AEPD)</strong>:{' '}
          <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}>
            https://www.aepd.es
          </a>.
        </p>

        <h2 style={h2Style}>7. Seguridad de los Datos</h2>
        <p style={pStyle}>
          Implementamos medidas técnicas y organizativas adecuadas para garantizar la seguridad de sus datos
          personales, incluyendo cifrado TLS en todas las comunicaciones en tránsito. Los datos de pago nunca
          se almacenan en nuestros servidores: son procesados directamente por Stripe mediante tokenización,
          cumpliendo con el estándar PCI DSS.
        </p>
        <p style={pStyle}>
          En caso de brecha de seguridad que pueda afectar a sus derechos y libertades, le notificaremos sin
          dilación indebida conforme al art. 34 del RGPD.
        </p>

        <h2 style={h2Style}>8. Contacto</h2>
        <div style={contactBox}>
          <p style={{ ...pStyle, marginBottom: '0.25rem' }}>
            Para cualquier consulta sobre el tratamiento de sus datos personales:
          </p>
          <p style={{ ...pStyle, marginBottom: '0.25rem' }}>
            📧 <a href="mailto:privacy@xopsalliance.com" style={{ color: '#38bdf8' }}>privacy@xopsalliance.com</a>
          </p>
          <p style={{ ...pStyle, marginBottom: 0 }}>
            📧 DPD: <a href="mailto:dpo@xopsalliance.com" style={{ color: '#38bdf8' }}>dpo@xopsalliance.com</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
