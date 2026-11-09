import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { LEGAL } from '../config/legal';
import { PaintStrip } from '../components/PaintBits';
import '../MapChrome.css';
import '../Legal.css';

// Texto legal solo en español e inglés (versiones de referencia). El resto de idiomas ve el inglés.
// No es asesoramiento jurídico: si el proyecto pasa a tener ingresos, que lo revise un abogado.
const Email = () => <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>;

const CONTENT = {
  es: {
    title: 'Normas y privacidad',
    updated: 'Última actualización',
    sections: [
      {
        id: 'who',
        title: 'Quién está detrás',
        body: (
          <>
            <p>SkateMap es un proyecto de código abierto y sin ánimo de lucro gestionado por {LEGAL.operator}. Contacto para cualquier asunto, incluidas las autoridades: <Email />.</p>
          </>
        ),
      },
      {
        id: 'rules',
        title: 'Normas de la comunidad',
        body: (
          <>
            <p>Los spots tienen que ser lugares reales para patinar. No se permite publicar:</p>
            <ul>
              <li>Desnudos o contenido sexual.</li>
              <li>Drogas ilegales o su promoción.</li>
              <li>Violencia, heridas, armas usadas de forma amenazante.</li>
              <li>Odio, acoso o amenazas.</li>
              <li>Anuncios, ventas, teléfonos, enlaces o cuentas de redes sociales.</li>
              <li>Datos personales de otras personas (documentos, matrículas, direcciones) o fotos de personas identificables sin su permiso.</li>
              <li>Fotos o textos sobre los que no tienes derechos, y spots inventados.</li>
            </ul>
          </>
        ),
      },
      {
        id: 'moderation',
        title: 'Cómo moderamos',
        body: (
          <>
            <p>Antes de publicarse, los textos los revisa una IA (Groq y OpenAI) y las fotos un modelo de moderación de OpenAI y una IA de visión. Si algo no cumple las normas no se publica y te decimos por qué; si la foto es demasiado oscura o borrosa te pedimos otra.</p>
            <p>Cualquier usuario con cuenta puede denunciar un spot. Una IA revisa la denuncia: si ve una infracción clara, o si varias personas denuncian el mismo spot, se oculta hasta que lo revise un administrador, que decide si se mantiene o se elimina. Lo eliminado se borra de verdad, también el archivo de la foto.</p>
            <p>Si eliminamos algo tuyo y no estás de acuerdo, escríbenos a <Email /> y lo revisaremos.</p>
          </>
        ),
      },
      {
        id: 'report',
        title: 'Denunciar contenido ilegal',
        body: (
          <>
            <p>Usa el botón de la bandera en el spot o, sin cuenta, escribe a <Email /> indicando el spot y el motivo.</p>
            <p>Si ves material de abuso sexual infantil, no lo descargues ni lo compartas: denúncialo a la Policía Nacional (<a href="mailto:denuncias.pornografia.infantil@policia.es">denuncias.pornografia.infantil@policia.es</a>) o en la línea de reporte de INCIBE. Lo retiramos de inmediato y colaboramos con las autoridades. En una emergencia llama al 112.</p>
          </>
        ),
      },
      {
        id: 'privacy',
        title: 'Privacidad',
        body: (
          <>
            <p><strong>Responsable:</strong> {LEGAL.operator}, <Email />.</p>
            <p><strong>Qué datos tratamos:</strong> tu cuenta (nombre de usuario, email, contraseña cifrada o tu identificador de Google), lo que publicas (spots con su ubicación, fotos, valoraciones, comentarios), tus denuncias y datos técnicos (la dirección IP se usa solo para limitar abusos y se guarda en memoria como máximo una hora).</p>
            <p><strong>Para qué y con qué base:</strong> para prestarte el servicio que pides al registrarte (art. 6.1.b RGPD) y para mantenerlo seguro y libre de abusos (interés legítimo, art. 6.1.f RGPD).</p>
            <p><strong>Con quién:</strong> Cloudinary (alojamiento de fotos), OpenAI y Groq (moderación automática de textos y fotos, solo para esa comprobación), Google (si entras con Google) y el proveedor de alojamiento del servidor. Algunos están fuera de la UE y se amparan en las cláusulas contractuales tipo de la Comisión Europea.</p>
            <p><strong>Cuánto tiempo:</strong> mientras tengas la cuenta; puedes pedir que la borremos con todo su contenido.</p>
            <p><strong>Tus derechos:</strong> acceso, rectificación, supresión, oposición y portabilidad escribiendo a <Email />. También puedes reclamar ante la Agencia Española de Protección de Datos (<a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">aepd.es</a>).</p>
          </>
        ),
      },
      {
        id: 'age',
        title: 'Edad mínima',
        body: <p>Para crear una cuenta tienes que tener al menos 14 años (art. 7 LOPDGDD).</p>,
      },
    ],
  },
  en: {
    title: 'Rules & privacy',
    updated: 'Last updated',
    sections: [
      {
        id: 'who',
        title: 'Who runs SkateMap',
        body: (
          <p>SkateMap is a non-commercial open-source project run by {LEGAL.operator}. Contact for anything, including authorities: <Email />.</p>
        ),
      },
      {
        id: 'rules',
        title: 'Community rules',
        body: (
          <>
            <p>Spots must be real places to skate. You may not post:</p>
            <ul>
              <li>Nudity or sexual content.</li>
              <li>Illegal drugs or their promotion.</li>
              <li>Violence, injuries, weapons shown threateningly.</li>
              <li>Hate, harassment or threats.</li>
              <li>Ads, sales, phone numbers, links or social media handles.</li>
              <li>Other people&apos;s personal data (documents, number plates, addresses) or photos of identifiable people without their permission.</li>
              <li>Photos or texts you don&apos;t have the rights to, and made-up spots.</li>
            </ul>
          </>
        ),
      },
      {
        id: 'moderation',
        title: 'How moderation works',
        body: (
          <>
            <p>Before anything is published, texts are checked by an AI (Groq and OpenAI) and photos by an OpenAI moderation model and a vision AI. Content that breaks the rules is not published and you are told why; if a photo is too dark or blurry you are asked for another one.</p>
            <p>Anyone with an account can report a spot. An AI reviews the report: if it sees a clear violation, or if several people report the same spot, the spot is hidden until an administrator reviews it and decides to keep or remove it. Removed content is really deleted, including the photo file.</p>
            <p>If we remove something of yours and you disagree, write to <Email /> and we will look at it again.</p>
          </>
        ),
      },
      {
        id: 'report',
        title: 'Reporting illegal content',
        body: (
          <>
            <p>Use the flag button on the spot or, without an account, email <Email /> with the spot and the reason.</p>
            <p>If you see child sexual abuse material, do not download or share it: report it to the Spanish National Police (<a href="mailto:denuncias.pornografia.infantil@policia.es">denuncias.pornografia.infantil@policia.es</a>) or INCIBE&apos;s reporting hotline. We remove it immediately and cooperate with the authorities. In an emergency call 112.</p>
          </>
        ),
      },
      {
        id: 'privacy',
        title: 'Privacy',
        body: (
          <>
            <p><strong>Controller:</strong> {LEGAL.operator}, <Email />.</p>
            <p><strong>What we process:</strong> your account (username, email, hashed password or your Google ID), what you publish (spots with their location, photos, ratings, comments), your reports, and technical data (your IP address is only used to limit abuse and kept in memory for at most one hour).</p>
            <p><strong>Why and on what basis:</strong> to provide the service you sign up for (Art. 6(1)(b) GDPR) and to keep it safe and free of abuse (legitimate interest, Art. 6(1)(f) GDPR).</p>
            <p><strong>Who else:</strong> Cloudinary (photo hosting), OpenAI and Groq (automated moderation of texts and photos, only for that check), Google (if you sign in with Google) and the server hosting provider. Some are outside the EU and rely on the European Commission&apos;s standard contractual clauses.</p>
            <p><strong>How long:</strong> while you have an account; you can ask us to delete it with all its content.</p>
            <p><strong>Your rights:</strong> access, rectification, erasure, objection and portability by writing to <Email />. You can also complain to the Spanish Data Protection Agency (<a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">aepd.es</a>).</p>
          </>
        ),
      },
      {
        id: 'age',
        title: 'Minimum age',
        body: <p>You must be at least 14 to create an account (Spanish data protection law, LOPDGDD Art. 7).</p>,
      },
    ],
  },
};

export default function LegalPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [lang, setLang] = useState(() => (/^(es|eu)\b/.test(i18n.language) ? 'es' : 'en'));
  const content = CONTENT[lang];
  const updated = new Intl.DateTimeFormat(lang, { dateStyle: 'long' }).format(new Date(`${LEGAL.updated}T12:00:00`));

  return (
    <div className="legal-page">
      <header className="admin-bar legal-bar">
        <h1 className="admin-title" lang={lang}>{content.title}</h1>
        <button type="button" className="bar-pill bar-pill-account" onClick={() => navigate('/map')}>
          <span className="bar-pill-text">{t('admin.backToMap')}</span>
        </button>
      </header>

      <main className="legal-main" lang={lang}>
        <div className="legal-lang" role="radiogroup" aria-label={t('common.language')}>
          {[['es', 'Español'], ['en', 'English']].map(([code, label]) => (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={lang === code}
              className={`choice-pill${lang === code ? ' is-selected' : ''}`}
              onClick={() => setLang(code)}
              lang={code}
            >
              {label}
            </button>
          ))}
        </div>

        <article className="legal-sheet">
          <PaintStrip />
          <nav className="legal-toc" aria-label={content.title}>
            {content.sections.map((s) => <a key={s.id} href={`#${s.id}`}>{s.title}</a>)}
          </nav>
          {content.sections.map((s) => (
            <section key={s.id} id={s.id} className="legal-section">
              <h2>{s.title}</h2>
              {s.body}
            </section>
          ))}
          <p className="legal-updated">{content.updated}: {updated}</p>
        </article>
      </main>
    </div>
  );
}
