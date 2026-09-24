import Image from 'next/image';

export default function PinTip({
  titleId,
  kicker,
  title,
  description,
  imageAlt,
  className = '',
}: {
  titleId: string;
  kicker: string;
  title: string;
  description: string;
  imageAlt: string;
  className?: string;
}) {
  return (
    <section
      className={`welcome-pin${className ? ` ${className}` : ''}`}
      aria-labelledby={titleId}
    >
      <div>
        <p className="welcome-kicker">{kicker}</p>
        <h2 id={titleId}>{title}</h2>
        <p>{description}</p>
      </div>
      <Image
        className="welcome-animation"
        src="/extension-pin-guide.png"
        alt={imageAlt}
        width={1024}
        height={643}
        sizes="(max-width: 820px) 100vw, 45vw"
      />
    </section>
  );
}
