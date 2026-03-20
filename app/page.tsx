import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        padding: "60px 24px",
      }}
    >
      <section
        style={{
          maxWidth: 980,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "6px 10px",
            border: "1px solid #222",
            borderRadius: 999,
            fontSize: 14,
            color: "#93c5fd",
            marginBottom: 20,
            background: "#0a0a0a",
          }}
        >
          Meta ads tool for agencies
        </div>

        <h1
          style={{
            fontSize: "clamp(40px, 7vw, 72px)",
            lineHeight: 1.05,
            margin: 0,
            maxWidth: 900,
          }}
        >
          Launch Meta retargeting ads
          <br />
          in seconds, not hours.
        </h1>

        <p
          style={{
            fontSize: 20,
            lineHeight: 1.6,
            color: "#a3a3a3",
            maxWidth: 720,
            marginTop: 24,
            marginBottom: 0,
          }}
        >
          One-Click Retargeting helps freelancers, SMMA teams, and small
          agencies launch website retargeting campaigns faster with less manual
          Meta Ads Manager setup.
        </p>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginTop: 32,
          }}
        >
          <Link
            href="/dashboard"
            style={{
              padding: "14px 20px",
              borderRadius: 10,
              background: "#2563eb",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Open Dashboard
          </Link>

          <a
            href="#how-it-works"
            style={{
              padding: "14px 20px",
              borderRadius: 10,
              border: "1px solid #2a2a2a",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            See how it works
          </a>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginTop: 56,
          }}
        >
          <FeatureCard
            title="Faster launch"
            text="Skip repetitive audience, ad set, and ad creation steps."
          />
          <FeatureCard
            title="Built for execution"
            text="Input your message, link, budget, and audience window in one place."
          />
          <FeatureCard
            title="Agency-friendly"
            text="Useful for freelancers, SMMAs, and lean teams running Meta ads for clients."
          />
        </div>
      </section>

      <section
        id="how-it-works"
        style={{
          maxWidth: 980,
          margin: "72px auto 0",
        }}
      >
        <div
          style={{
            border: "1px solid #1f1f1f",
            borderRadius: 18,
            padding: 28,
            background: "#0a0a0a",
          }}
        >
          <h2 style={{ fontSize: 32, marginTop: 0 }}>How it works</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              marginTop: 20,
            }}
          >
            <StepCard
              number="01"
              title="Fill in the ad details"
              text="Add your ad message, destination link, product name, daily budget, and audience window."
            />
            <StepCard
              number="02"
              title="Click launch"
              text="The system creates the audience, ad set, and ad for you."
            />
            <StepCard
              number="03"
              title="Review in Meta"
              text="Check the created assets in Ads Manager and continue from there."
            />
          </div>
        </div>
      </section>

      <section
        style={{
          maxWidth: 980,
          margin: "32px auto 0",
        }}
      >
        <div
          style={{
            border: "1px solid #1f1f1f",
            borderRadius: 18,
            padding: 28,
            background: "#0a0a0a",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: 20,
            alignItems: "center",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 28 }}>
              Ready to test the flow?
            </h3>
            <p style={{ color: "#a3a3a3", marginBottom: 0 }}>
              Open the dashboard and launch a retargeting campaign.
            </p>
          </div>

          <Link
            href="/dashboard"
            style={{
              padding: "14px 20px",
              borderRadius: 10,
              background: "#2563eb",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            Go to Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}

function FeatureCard({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #1f1f1f",
        borderRadius: 16,
        padding: 20,
        background: "#0a0a0a",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 10, fontSize: 20 }}>{title}</h3>
      <p style={{ margin: 0, color: "#a3a3a3", lineHeight: 1.6 }}>{text}</p>
    </div>
  );
}

function StepCard({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #1f1f1f",
        borderRadius: 16,
        padding: 20,
        background: "#050505",
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: "#60a5fa",
          marginBottom: 10,
          fontWeight: 700,
          letterSpacing: 1,
        }}
      >
        {number}
      </div>
      <h3 style={{ marginTop: 0, marginBottom: 10, fontSize: 20 }}>{title}</h3>
      <p style={{ margin: 0, color: "#a3a3a3", lineHeight: 1.6 }}>{text}</p>
    </div>
  );
}