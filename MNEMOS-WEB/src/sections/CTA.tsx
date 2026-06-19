import { SITE } from "../lib/site";
import { MnemosMark } from "../lib/logos";
import GitHubProfile from "../components/ui/GitHubProfile";
import InstallCard from "../components/ui/InstallCard";
import Reveal from "../components/ui/Reveal";

export default function CTA() {
  return (
    <section className="container-px mx-auto max-w-[1200px] py-24 sm:py-28">
      <Reveal>
        <div className="relative isolate overflow-hidden rounded-[2rem] border border-[var(--border-strong)] bg-[var(--brand)] px-6 py-20 text-center text-white sm:px-16">
          {/* ambient brand glow */}
          <div
            className="absolute left-1/2 top-0 -z-10 h-[400px] w-[700px] -translate-x-1/2 animate-aurora rounded-full opacity-40 blur-[90px]"
            style={{ background: "var(--brand-deep)" }}
            aria-hidden
          />
          <div className="absolute inset-0 -z-10 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "22px 22px" }} aria-hidden />

          <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-white/20 bg-white/10 text-white shadow-[0_18px_60px_-18px_rgba(0,0,0,0.45)]">
            <MnemosMark size={36} color="#ffffff" />
          </div>

          <h2 className="mx-auto max-w-2xl text-balance text-[2.3rem] font-semibold leading-[1.05] tracking-tight text-white sm:text-[3rem]">
            This is the future of
            <br /> <span className="font-serif italic text-white">software understanding.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[1.05rem] leading-relaxed text-white/80">
            Don't let your code be forgotten. Give your repository a memory that humans
            and AI can use — in one command.
          </p>

          {/* terminal pill + docs (recreation of the brand card) */}
          <div className="mx-auto mt-10 w-full max-w-xl">
            <InstallCard />

            {/* view repo · made by */}
            <div className="mt-6 flex flex-col items-center justify-between gap-6 sm:flex-row">
              <a
                href={SITE.github}
                target="_blank"
                rel="noopener noreferrer"
                className="font-serif text-lg italic text-[var(--text-dim)] underline-offset-4 transition-colors hover:text-[var(--text)] hover:underline"
              >
                view the repo →
              </a>
              <GitHubProfile delay={0} />
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
