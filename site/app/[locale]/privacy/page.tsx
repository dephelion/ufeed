import Link from 'next/link';
import { breadcrumbLd, pageMetadata } from '../../lib/seo';
import { SITE_URL } from '../../lib/site';

const title = 'uFeed Browser Extension Privacy Policy | what it reads and stores';
const description =
  'See what the uFeed browser extension reads on X, LinkedIn and Reddit, what stays in your browser, and its one-time model download. No tracking.';
const path = '/privacy/';

export const metadata = pageMetadata({
  title,
  description,
  path,
  keywords: [
    'uFeed privacy policy',
    'private browser extension',
    'on-device data processing',
    'browser extension data use',
  ],
});

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const es = locale === 'es';
  const prefix = `/${locale}`;
  if (es) return <main className="legal wrap"><Link className="back" href={`${prefix}/`}>← uFeed</Link><h1>Política de privacidad</h1><p className="legal-date">Última actualización: 23 de septiembre de 2026</p><p className="legal-lead">uFeed funciona en tu dispositivo. No recopila tus datos y no podemos ver qué lees ni qué temas eliges.</p><h2>Qué lee uFeed</h2><p>En X (x.com y twitter.com), LinkedIn y Reddit, uFeed lee el texto de las publicaciones para compararlo con tus temas. La comparación ocurre en tu navegador. El texto se conserva temporalmente en memoria mientras se analiza y después se descarta. No se guarda, transmite ni registra. uFeed no actúa en otros sitios web.</p><h2>Qué permanece en tu dispositivo</h2><p>Tus temas y ajustes se guardan en el almacenamiento local de la extensión. Si activas «Aprender de mis valoraciones», uFeed también guarda representaciones numéricas de las publicaciones que valoras. Pueden conservar cierta información de la publicación original, por lo que se tratan como datos personales. Permanecen en tu dispositivo, con un máximo de 50 valoraciones positivas y 50 negativas por tema.</p><p>Una copia exportada contiene tus ajustes y valoraciones guardadas. Guárdala en un lugar privado. Al importar una copia, se reemplazan los ajustes y las valoraciones de la extensión.</p><h2>Qué envía uFeed</h2><p>La primera vez que se necesita un modelo de lenguaje, el navegador lo descarga de Hugging Face. La solicitud revela tu dirección IP a ese servicio, como cualquier descarga, pero no incluye tus temas ni el contenido de tu feed. El navegador guarda el modelo para usarlo después. Es la única solicitud de red de uFeed; no hay un servidor de uFeed.</p><h2>Permisos</h2><ul><li><strong>Sitios compatibles:</strong> leer el texto y aplicar el difuminado en X, LinkedIn y Reddit.</li><li><strong>Almacenamiento:</strong> guardar tus ajustes y valoraciones opcionales en el dispositivo.</li><li><strong>Página offscreen (Chrome):</strong> ejecutar el modelo multilingüe en un proceso compartido de la extensión. Recibe texto para analizar, pero no puede leer el sitio web.</li></ul><h2>Cómo borrar tus datos</h2><p>Usa «Borrar ajustes de aprendizaje» para eliminar las valoraciones, o «Restablecer» para borrarlas y restaurar los ajustes predeterminados. Desinstalar uFeed elimina los datos locales. Nosotros no guardamos nada y no hay ninguna cuenta que borrar.</p><h2>Menores y cambios</h2><p>uFeed no está dirigido a menores y no recopila datos de nadie. Si esta política cambia, actualizaremos la fecha de esta página.</p><p className="legal-end"><Link href={`${prefix}/terms/`}>Términos de uso</Link> · <Link href={`${prefix}/`}>Volver a uFeed</Link></p></main>;
  return (
    <main className="legal wrap">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': 'WebPage',
              name: title,
              description,
              url: `${SITE_URL}${path}`,
            },
            breadcrumbLd(path, 'Privacy policy'),
          ]).replace(/</g, '\\u003c'),
        }}
      />
      <Link className="back" href="/">
        ← uFeed
      </Link>
      <h1>Privacy policy</h1>
      <p className="legal-date">Last updated 23 September 2026</p>
      <p className="legal-lead">
        uFeed works on your device. It does not collect your data, and we cannot see what
        you read or which topics you choose.
      </p>
      <h2>What uFeed reads</h2>
      <p>
        On X (x.com and twitter.com), LinkedIn and Reddit, uFeed reads the text of posts
        in the page to compare them with your topics. The comparison happens in your
        browser. Post text is held in memory while it is scored, then discarded. It is not
        written to disk, sent over the network or logged. uFeed does nothing on other
        websites.
      </p>
      <h2>What stays on your device</h2>
      <p>
        Your topics and settings are saved in your browser’s local extension storage. If
        you turn on “Learn from my thumbs,” uFeed also saves number-based representations
        of posts you rate. These can retain some information about the original post, so
        they are treated as personal data. They stay on your device, with up to 50
        positive and 50 negative ratings per topic.
      </p>
      <p>
        If you choose to export a backup, the file contains your settings and any saved
        ratings. Keep that file somewhere private. Importing a backup replaces the
        settings and ratings already in the extension.
      </p>
      <h2>What uFeed sends</h2>
      <p>
        The first time a language model is needed, your browser downloads it from Hugging
        Face. This request reveals your IP address to that service, as any download does.
        It does not include your topics or feed content. Your browser caches the model for
        later use. This is the only network request uFeed makes; there is no uFeed server.
      </p>
      <h2>Permissions</h2>
      <ul>
        <li>
          <strong>Supported websites:</strong> to read post text and apply the blur on X,
          LinkedIn and Reddit.
        </li>
        <li>
          <strong>Storage:</strong> to keep your settings and optional ratings on your
          device.
        </li>
        <li>
          <strong>Offscreen page (Chrome):</strong> to run the multilingual model in a
          shared extension worker. It receives text for scoring but cannot read the
          website.
        </li>
      </ul>
      <h2>Deleting your data</h2>
      <p>
        Use “Clear tuning” to delete ratings, or “Reset” to clear ratings and restore
        default settings. Uninstalling uFeed removes its locally stored data. Nothing is
        held by us, and there is no account to delete.
      </p>
      <h2>Children and changes</h2>
      <p>
        uFeed is not directed at children and collects no data from anyone. If this policy
        changes, this page’s date will be updated.
      </p>
      <p className="legal-end">
        <Link href={`${prefix}/terms/`}>Terms of use</Link> · <Link href={`${prefix}/`}>Back to uFeed</Link>
      </p>
    </main>
  );
}
