import type { Photo } from '../lib/pulsePhotos';

// A photo strip that opens a tab: the picture is dimmed and faded into the
// page's black so it reads as atmosphere, with the tab's title and a plain
// one-line description over it. The credit is linked, small, and always
// present.
export function PulseBanner({ photo, title, blurb }: { photo: Photo; title: string; blurb: string }) {
  return (
    <div className="relative isolate overflow-hidden border border-hairline">
      <img
        src={photo.src}
        alt=""
        loading="lazy"
        decoding="async"
        width={1400}
        height={930}
        className="absolute inset-0 -z-10 h-full w-full object-cover opacity-80"
        style={{ objectPosition: photo.position }}
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-paper via-paper/70 to-transparent" />
      <div className="absolute inset-0 -z-10 bg-paper/40 sm:hidden" />
      <div className="px-5 pb-9 pt-6 sm:px-6 sm:pt-8">
        <h2 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">{title}</h2>
        <p className="mt-1 max-w-xl font-sans text-sm text-ink-muted">{blurb}</p>
      </div>
      <a
        href={photo.href}
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-1.5 right-2 max-w-[80%] truncate font-sans text-[10px] text-ink-faint no-underline hover:text-ink-muted"
      >
        Photo: {photo.credit}
      </a>
    </div>
  );
}
