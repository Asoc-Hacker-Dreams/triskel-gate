import React from 'react';

const TermsOfService: React.FC = () => {
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
        <h1 style={{ color: '#f8fafc', fontSize: '2rem', margin: '1rem 0 0.25rem' }}>Términos de Servicio</h1>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '2rem' }}>Última actualización: junio 2025</p>

        <p style={pStyle}>
          Los presentes Términos de Servicio regulan el acceso y uso de la plataforma Triskell Gate, titularidad de
          <strong style={{ color: '#cbd5e1' }}> X-Ops Alliance, S.L.</strong>, con domicilio en Madrid, España.
          El acceso a la plataforma implica la aceptación plena y sin reservas de las presentes condiciones.
        </p>

        <h2 style={h2Style}>1. Objeto y Descripción del Servicio</h2>
        <p style={pStyle}>
          Triskell Gate es una plataforma digital de gestión y venta de entradas para eventos. El servicio permite
          a los organizadores crear y administrar eventos, y a los usuarios adquirir entradas, acceder a confirmaciones
          de compra mediante código QR y gestionar su historial de asistencia.
        </p>
        <p style={pStyle}>
          X-Ops Alliance, S.L. actúa como prestador de servicios de la sociedad de la información conforme a la Ley
          34/2002, de Servicios de la Sociedad de la Información y Comercio Electrónico (LSSI-CE).
        </p>

        <h2 style={h2Style}>2. Acceso y Registro</h2>
        <p style={pStyle}>
          El acceso a determinadas funcionalidades de Triskell Gate requiere el registro previo mediante la creación
          de una cuenta de usuario. Para ello se establecen los siguientes requisitos:
        </p>
        <ul style={{ color: '#94a3b8', lineHeight: '1.9', paddingLeft: '1.5rem', marginBottom: '0.75rem' }}>
          <li>Ser mayor de 18 años. El uso de la plataforma por menores de edad no está permitido.</li>
          <li>Proporcionar información veraz, exacta y actualizada durante el proceso de registro.</li>
          <li>Mantener la confidencialidad de las credenciales de acceso y no cederlas a terceros.</li>
          <li>Notificar de forma inmediata cualquier uso no autorizado de su cuenta.</li>
        </ul>
        <p style={pStyle}>
          X-Ops Alliance, S.L. se reserva el derecho de suspender o cancelar una cuenta cuando se detecte la
          provisión de información falsa o el incumplimiento de los presentes Términos.
        </p>

        <h2 style={h2Style}>3. Compra de Entradas</h2>
        <p style={pStyle}>
          El proceso de compra de entradas a través de Triskell Gate se desarrolla de la siguiente forma:
        </p>
        <ul style={{ color: '#94a3b8', lineHeight: '1.9', paddingLeft: '1.5rem', marginBottom: '0.75rem' }}>
          <li>El usuario selecciona el evento y la cantidad de entradas deseadas.</li>
          <li>El pago se realiza de forma segura a través de Stripe, Inc., conforme a su política de privacidad.</li>
          <li>Una vez completado el pago, el usuario recibirá una confirmación por correo electrónico con el código QR de acceso.</li>
          <li>Las entradas son nominales e intransferibles salvo autorización expresa del organizador del evento.</li>
        </ul>
        <p style={pStyle}>
          La compra de una entrada constituye un contrato entre el usuario y el organizador del evento. Triskell Gate
          actúa como intermediario tecnológico en dicha transacción.
        </p>

        <h2 style={h2Style}>4. Política de Reembolsos</h2>
        <p style={pStyle}>
          Con carácter general, <strong style={{ color: '#cbd5e1' }}>no se aceptan devoluciones ni reembolsos</strong> una
          vez completada la compra de una entrada, salvo en los casos previstos en la normativa aplicable o en las
          condiciones particulares del evento.
        </p>
        <p style={pStyle}>
          En caso de <strong style={{ color: '#cbd5e1' }}>cancelación del evento por parte del organizador</strong>, el
          usuario tendrá derecho al reembolso íntegro del importe abonado. El reembolso se efectuará en el método de
          pago original en un plazo máximo de <strong style={{ color: '#cbd5e1' }}>14 días hábiles</strong> desde la
          comunicación oficial de la cancelación.
        </p>
        <p style={pStyle}>
          Los cambios de fecha o modificaciones en el programa del evento no darán derecho automático a reembolso
          salvo disposición expresa del organizador. Para reclamaciones relacionadas con reembolsos, contacte con
          el organizador del evento o con{' '}
          <a href="mailto:privacy@xopsalliance.com" style={{ color: '#38bdf8' }}>privacy@xopsalliance.com</a>.
        </p>

        <h2 style={h2Style}>5. Transferencia de Entradas</h2>
        <p style={pStyle}>
          La reventa, cesión o transferencia de entradas a terceros queda expresamente prohibida salvo autorización
          escrita del organizador del evento. Queda especialmente prohibida:
        </p>
        <ul style={{ color: '#94a3b8', lineHeight: '1.9', paddingLeft: '1.5rem', marginBottom: '0.75rem' }}>
          <li>La reventa de entradas a través de plataformas de terceros o canales no autorizados.</li>
          <li>La transferencia de entradas con fines lucrativos (especulación o escalping).</li>
          <li>La duplicación o reproducción de los códigos QR asociados a las entradas.</li>
        </ul>
        <p style={pStyle}>
          El incumplimiento de esta cláusula podrá dar lugar a la anulación de la entrada sin derecho a reembolso
          y a la suspensión de la cuenta del usuario infractor.
        </p>

        <h2 style={h2Style}>6. Obligaciones del Usuario</h2>
        <p style={pStyle}>El usuario se compromete a hacer uso de la plataforma de forma lícita y conforme a los presentes Términos. En particular, queda prohibido:</p>
        <ul style={{ color: '#94a3b8', lineHeight: '1.9', paddingLeft: '1.5rem', marginBottom: '0.75rem' }}>
          <li>Manipular, alterar o interferir en el sistema de check-in o en los mecanismos de validación de entradas.</li>
          <li>Falsificar, reproducir o modificar códigos QR u otros elementos de seguridad de las entradas.</li>
          <li>Intentar acceder a áreas o funcionalidades de la plataforma para las que no se disponga de autorización.</li>
          <li>Facilitar el acceso a terceros no autorizados a su cuenta de usuario.</li>
        </ul>

        <h2 style={h2Style}>7. Usos Prohibidos</h2>
        <p style={pStyle}>Con independencia de lo dispuesto en la cláusula anterior, queda expresamente prohibido:</p>
        <ul style={{ color: '#94a3b8', lineHeight: '1.9', paddingLeft: '1.5rem', marginBottom: '0.75rem' }}>
          <li><strong style={{ color: '#cbd5e1' }}>Scraping y extracción masiva de datos:</strong> la extracción automatizada de contenidos o datos de la plataforma mediante bots, scrapers u otras herramientas automatizadas.</li>
          <li><strong style={{ color: '#cbd5e1' }}>Bots de compra:</strong> el uso de sistemas automatizados para la adquisición masiva de entradas.</li>
          <li><strong style={{ color: '#cbd5e1' }}>Fraude:</strong> cualquier conducta fraudulenta, incluidas contracargos injustificados o uso de métodos de pago no autorizados.</li>
          <li><strong style={{ color: '#cbd5e1' }}>Suplantación de identidad:</strong> hacerse pasar por otro usuario, organizador o por personal de X-Ops Alliance, S.L.</li>
          <li>Cualquier uso que contravenga la legislación española o europea vigente.</li>
        </ul>
        <p style={pStyle}>
          El incumplimiento de estas prohibiciones podrá dar lugar a la suspensión inmediata de la cuenta y, en su caso,
          a la adopción de las acciones legales oportunas.
        </p>

        <h2 style={h2Style}>8. Responsabilidad</h2>
        <p style={pStyle}>
          <strong style={{ color: '#cbd5e1' }}>Triskell Gate actúa exclusivamente como intermediario tecnológico</strong> entre
          los organizadores y los asistentes a los eventos. El organizador de cada evento es el único responsable
          del contenido, desarrollo, cancelación o modificación del mismo, así como del cumplimiento de la normativa
          aplicable al evento.
        </p>
        <p style={pStyle}>
          X-Ops Alliance, S.L. no asume responsabilidad por daños derivados de la cancelación, modificación o
          deficiente organización de un evento por parte del organizador, ni por circunstancias de fuerza mayor o
          causas ajenas al control de la plataforma.
        </p>
        <p style={pStyle}>
          La responsabilidad de X-Ops Alliance, S.L. se limita, en todo caso, al importe total abonado por el
          usuario en la transacción objeto de reclamación.
        </p>

        <h2 style={h2Style}>9. Modificaciones del Servicio y los Términos</h2>
        <p style={pStyle}>
          X-Ops Alliance, S.L. se reserva el derecho a modificar los presentes Términos de Servicio, las
          funcionalidades de la plataforma o las tarifas aplicables. Cualquier modificación sustancial será
          comunicada a los usuarios con un preaviso mínimo de <strong style={{ color: '#cbd5e1' }}>30 días</strong> a través
          del correo electrónico asociado a su cuenta o mediante aviso destacado en la plataforma.
        </p>
        <p style={pStyle}>
          El uso continuado de Triskell Gate tras la entrada en vigor de las modificaciones implicará la aceptación
          de los nuevos Términos. Si el usuario no acepta los cambios, deberá cesar el uso de la plataforma y podrá
          solicitar la cancelación de su cuenta.
        </p>

        <h2 style={h2Style}>10. Ley Aplicable y Jurisdicción</h2>
        <p style={pStyle}>
          Los presentes Términos de Servicio se rigen por el <strong style={{ color: '#cbd5e1' }}>derecho español</strong>.
          Para la resolución de cualquier controversia derivada de la interpretación o aplicación de estos Términos,
          las partes se someten expresamente a la jurisdicción de los{' '}
          <strong style={{ color: '#cbd5e1' }}>Juzgados y Tribunales de Madrid</strong>, con renuncia expresa a
          cualquier otro fuero que pudiera corresponderles.
        </p>
        <p style={pStyle}>
          Sin perjuicio de lo anterior, si usted actúa en calidad de consumidor, podrá acudir a los mecanismos
          de resolución alternativa de litigios previstos en la normativa de consumo aplicable, incluyendo la
          plataforma europea de resolución de litigios en línea:{' '}
          <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}>
            https://ec.europa.eu/consumers/odr
          </a>.
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

export default TermsOfService;
