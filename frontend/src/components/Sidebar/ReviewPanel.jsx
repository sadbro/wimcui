import { useState } from "react";
import { buildContext } from "../../config/canvasContext";
import { consequenceRules, CATEGORY_LABELS } from "../../config/consequenceRules";

const MONO = { fontFamily: "'JetBrains Mono', Consolas, monospace", fontWeight: 800 };

const TABS = ["Summary", "Consequences", "HCL Readiness"];

// ─── Shared ───────────────────────────────────────────────────────────────────

function SectionHeader({ title, count }) {
  return (
    <div style={{
      ...MONO, fontSize: 11, letterSpacing: 2,
      color: "var(--text-muted)", textTransform: "uppercase",
      marginBottom: 8, marginTop: 24,
      display: "flex", justifyContent: "space-between", alignItems: "center",
    }}>
      <span>{title}</span>
      {count !== undefined && (
        <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 0 }}>({count})</span>
      )}
    </div>
  );
}

// ─── Summary Tab — compact rows, truncate + tooltip ───────────────────────────

function Row({ cols }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: cols.map((c) => c.width || "1fr").join(" "),
      gap: "0 12px",
      padding: "5px 0",
      borderBottom: "1px solid var(--border-subtle)",
    }}>
      {cols.map((c, i) => (
        <span key={i} title={c.text ?? ""} style={{
          ...MONO, fontSize: 12,
          color: c.dim ? "var(--text-muted)" : "var(--text-primary)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {c.text ?? "—"}
        </span>
      ))}
    </div>
  );
}

function SummaryTab({ ctx }) {
  const { vpcs, subnets, ec2, rds, lbs, igws, nats, rts, assocEdges, trafficEdges, nodeById } = ctx;

  return (
    <div>
      {vpcs.length > 0 && <>
        <SectionHeader title="VPCs" />
        {vpcs.map((n) => (
          <Row key={n.id} cols={[
            { text: n.data.label,        width: "180px" },
            { text: n.data.config?.cidr, width: "auto", dim: true },
          ]} />
        ))}
      </>}

      {subnets.length > 0 && <>
        <SectionHeader title="Subnets" />
        {subnets.map((n) => {
          const vpc = nodeById(n.data.config?.vpcId);
          return (
            <Row key={n.id} cols={[
              { text: n.data.label,                    width: "130px" },
              { text: n.data.config?.cidr,             width: "105px", dim: true },
              { text: n.data.config?.visibility,       width: "55px",  dim: true },
              { text: n.data.config?.availability_zone, width: "100px", dim: true },
              { text: vpc?.data?.label,                width: "auto",  dim: true },
            ]} />
          );
        })}
      </>}

      {(ec2.length > 0 || rds.length > 0 || lbs.length > 0) && <>
        <SectionHeader title="Compute" />
        {ec2.map((n) => {
          const subnet = nodeById(n.data.config?.subnetId);
          return (
            <Row key={n.id} cols={[
              { text: n.data.label,                 width: "140px" },
              { text: n.data.config?.instance_type, width: "90px", dim: true },
              { text: subnet?.data?.label,          width: "auto", dim: true },
            ]} />
          );
        })}
        {rds.map((n) => {
          const subnet = nodeById(n.data.config?.subnetId);
          return (
            <Row key={n.id} cols={[
              { text: n.data.label,                                                 width: "140px" },
              { text: `${n.data.config?.engine} ${n.data.config?.engine_version}`, width: "90px", dim: true },
              { text: subnet?.data?.label,                                          width: "auto", dim: true },
            ]} />
          );
        })}
        {lbs.map((n) => {
          const subnetIds = n.data?.config?.subnets || [];
          return (
            <Row key={n.id} cols={[
              { text: n.data.label,                          width: "140px" },
              { text: n.data.config?.load_balancer_type,     width: "90px",  dim: true },
              { text: n.data.config?.internal === "true" ? "internal" : "internet-facing", width: "110px", dim: true },
              { text: `${subnetIds.length} subnet${subnetIds.length !== 1 ? "s" : ""}`, width: "auto", dim: true },
            ]} />
          );
        })}
      </>}

      {(igws.length > 0 || nats.length > 0 || rts.length > 0) && <>
        <SectionHeader title="Networking" />
        {igws.map((n) => {
          const vpc = nodeById(n.data.config?.vpcId);
          return (
            <Row key={n.id} cols={[
              { text: n.data.label,     width: "140px" },
              { text: "igw",            width: "50px",  dim: true },
              { text: vpc?.data?.label, width: "auto",  dim: true },
            ]} />
          );
        })}
        {nats.map((n) => {
          const subnet = nodeById(n.data.config?.subnetId);
          return (
            <Row key={n.id} cols={[
              { text: n.data.label,                     width: "140px" },
              { text: n.data.config?.connectivity_type, width: "60px",  dim: true },
              { text: subnet?.data?.label,              width: "auto",  dim: true },
            ]} />
          );
        })}
        {rts.map((n) => {
          const routes = n.data?.config?.routes || [];
          const vpc = nodeById(n.data.config?.vpcId);
          return (
            <Row key={n.id} cols={[
              { text: n.data.label,                                               width: "140px" },
              { text: `${routes.length} route${routes.length !== 1 ? "s" : ""}`, width: "70px", dim: true },
              { text: vpc?.data?.label,                                           width: "auto",  dim: true },
            ]} />
          );
        })}
      </>}

      {assocEdges.length > 0 && <>
        <SectionHeader title="Associations" />
        {assocEdges.map((e) => {
          const src = nodeById(e.source);
          const tgt = nodeById(e.target);
          return (
            <Row key={e.id} cols={[
              { text: src?.data?.label, width: "160px" },
              { text: "->",             width: "24px",  dim: true },
              { text: tgt?.data?.label, width: "auto",  dim: true },
            ]} />
          );
        })}
      </>}

      {trafficEdges.length > 0 && <>
        <SectionHeader title="Traffic" />
        {trafficEdges.map((e) => {
          const src = nodeById(e.source);
          const tgt = nodeById(e.target);
          const ing = e.data?.ingress?.length || 0;
          const eg  = e.data?.egress?.length  || 0;
          return (
            <Row key={e.id} cols={[
              { text: src?.data?.label,    width: "120px" },
              { text: "<->",               width: "30px",  dim: true },
              { text: tgt?.data?.label,    width: "110px" },
              { text: `${ing}in ${eg}out`, width: "auto",  dim: true },
            ]} />
          );
        })}
      </>}
    </div>
  );
}

// ─── Consequences Tab — wrapped text blocks, grouped by category ──────────────

function ConsequencesTab({ ctx }) {
  const results = [];
  consequenceRules.forEach((rule) => {
    try {
      const matches = rule.check(ctx);
      matches.forEach((m) => results.push({ ...m, category: rule.category, id: rule.id }));
    } catch (_) {}
  });

  if (results.length === 0) {
    return (
      <div style={{ ...MONO, fontSize: 13, color: "var(--text-muted)", marginTop: 24 }}>
        No consequences detected.
      </div>
    );
  }

  const grouped = results.reduce((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {});

  return (
    <div>
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat}>
          <SectionHeader title={CATEGORY_LABELS[cat] || cat} count={items.length} />
          {items.map((item, i) => (
            <div key={i} style={{
              padding: "8px 0",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex", gap: 10, alignItems: "flex-start",
            }}>
              <span style={{
                ...MONO, fontSize: 11,
                color: "var(--text-muted)",
                paddingTop: 2, flexShrink: 0,
              }}>
                {">"}
              </span>
              <span style={{
                ...MONO, fontSize: 13,
                color: "var(--text-secondary)",
                lineHeight: 1.6,
                whiteSpace: "normal",
                wordBreak: "break-word",
              }}>
                {item.message}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── HCL Readiness Tab — wrapped status lines ─────────────────────────────────

function buildHclChecks(ctx) {
  const checks = [];
  const { vpcs, subnets, ec2, rds, lbs, igws, nats, rts, assocEdges, anyRtRoutesTo, rtBySubnet, publicSubnets, hasTrafficEdge, hasAnyEdge, nodes, nodeById } = ctx;

  // Hard fails — Terraform will not apply
  rts.forEach((rt) => {
    if ((rt.data?.config?.routes || []).length === 0)
      checks.push({ ok: false, warn: false, message: `${rt.data.label} has no routes defined` });
  });

  rts.forEach((rt) => {
    const linked = assocEdges.some((e) => e.source === rt.id || e.target === rt.id);
    if (!linked)
      checks.push({ ok: false, warn: false, message: `${rt.data.label} is not associated with any Subnet` });
  });

  subnets.forEach((n) => {
    if (!n.data?.config?.availability_zone)
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing Availability Zone` });
  });

  ec2.forEach((n) => {
    if (!n.data?.config?.ami)
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing AMI ID` });
  });

  rds.forEach((n) => {
    if (!n.data?.config?.password)
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing master password` });
  });

  // Hard fails — missing associations and routes
  subnets.forEach((s) => {
    if (!rtBySubnet[s.id])
      checks.push({ ok: false, warn: false, message: `${s.data.label} has no Route Table associated` });
  });

  igws.forEach((igw) => {
    if (!anyRtRoutesTo(igw.id))
      checks.push({ ok: false, warn: false, message: `${igw.data.label} exists but no Route Table routes to it` });
  });

  nats.forEach((nat) => {
    if (!anyRtRoutesTo(nat.id))
      checks.push({ ok: false, warn: false, message: `${nat.data.label} exists but no Route Table routes to it` });
  });

  // NAT in private subnet — Terraform applies but NAT is non-functional
  nats.forEach((nat) => {
    const subnet = nodeById(nat.data?.config?.subnetId);
    if (subnet && subnet.data?.config?.visibility !== "Public")
      checks.push({ ok: false, warn: false, message: `${nat.data.label} is in a private subnet — NAT Gateway must be in a public subnet to function` });
  });

  // No public subnet — IGW, NAT, internet-facing LB all require one
  vpcs.forEach((vpc) => {
    const hasPublic = publicSubnets.some((s) => s.data?.config?.vpcId === vpc.id);
    if (!hasPublic && (igws.length > 0 || nats.length > 0 || lbs.some((lb) => lb.data?.config?.internal === "false")))
      checks.push({ ok: false, warn: false, message: `${vpc.data.label} has no public subnet — required for IGW, NAT Gateway, and internet-facing Load Balancers` });
  });

  // Internet-facing ALB in private subnets — Terraform hard fails (InvalidSubnet)
  lbs.forEach((lb) => {
    if (lb.data?.config?.internal === "true") return;
    const subnetIds = lb.data?.config?.subnets || [];
    const allPrivate = subnetIds.length > 0 && subnetIds.every((id) =>
      !publicSubnets.some((ps) => ps.id === id)
    );
    if (allPrivate)
      checks.push({ ok: false, warn: false, message: `${lb.data.label} is internet-facing but all subnets are private — AWS will reject this (InvalidSubnet error)` });
  });

  // LB hard fails
  lbs.forEach((n) => {
    const subnetIds = n.data?.config?.subnets || [];
    if (subnetIds.length < 2)
      checks.push({ ok: false, warn: false, message: `${n.data.label} requires at least 2 subnets` });

    if (!n.data?.config?.tg_port)
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing Target Group port` });

    if (!n.data?.config?.listener_port)
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing Listener port` });

    // Subnets in same AZ
    const azs = subnetIds.map((id) => nodeById(id)?.data?.config?.availability_zone).filter(Boolean);
    const uniqueAzs = new Set(azs);
    if (subnetIds.length >= 2 && uniqueAzs.size < 2)
      checks.push({ ok: false, warn: false, message: `${n.data.label} subnets must be in at least 2 different Availability Zones` });
  });

  // Warnings — Terraform applies but may be unintentional
  lbs.forEach((n) => {
    if (!hasTrafficEdge(n.id))
      checks.push({ ok: false, warn: true, message: `${n.data.label} has no traffic connections` });
  });

  nodes.forEach((n) => {
    if (n.data?.resourceType === "Public") return;
    if (!hasAnyEdge(n.id))
      checks.push({ ok: false, warn: true, message: `${n.data.label} is orphaned (no edges)` });
  });

  if (checks.length === 0)
    checks.push({ ok: true, warn: false, message: "Canvas is ready for HCL export" });

  return checks;
}

function HclReadinessTab({ ctx }) {
  const checks = buildHclChecks(ctx);

  return (
    <div style={{ marginTop: 8 }}>
      {checks.map((c, i) => {
        const color  = c.ok ? "var(--success)" : c.warn ? "#fa8c16" : "var(--danger)";
        const symbol = c.ok ? "ok" : c.warn ? "warn" : "fail";
        return (
          <div key={i} style={{
            padding: "10px 0",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex", gap: 12, alignItems: "flex-start",
          }}>
            <span style={{ ...MONO, fontSize: 11, color, flexShrink: 0, paddingTop: 2, minWidth: 32 }}>
              [{symbol}]
            </span>
            <span style={{
              ...MONO, fontSize: 13,
              color: c.ok ? "var(--text-muted)" : "var(--text-primary)",
              lineHeight: 1.6,
              whiteSpace: "normal",
              wordBreak: "break-word",
            }}>
              {c.message}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function ReviewPanel({ nodes, edges, onClose, region }) {
  const [activeTab, setActiveTab] = useState(0);
  const ctx = buildContext(nodes, edges);

  const hclChecks  = buildHclChecks(ctx);
  const errors     = hclChecks.filter((c) => !c.ok && !c.warn).length;
  const warnings   = hclChecks.filter((c) => !c.ok && c.warn).length;

  const consequences = [];
  consequenceRules.forEach((rule) => {
    try { consequences.push(...rule.check(ctx)); } catch (_) {}
  });

  return (
    <div style={{
      position: "absolute", top: 0, right: 0,
      width: 440, height: "100%",
      background: "var(--bg-surface)",
      borderLeft: "1px solid var(--border)",
      zIndex: 20, display: "flex", flexDirection: "column",
      boxShadow: "-4px 0 24px rgba(0,0,0,0.3)",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 18px",
        borderBottom: "1px solid var(--border)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexShrink: 0,
      }}>
        <div>
          <div style={{ ...MONO, fontSize: 14, color: "var(--text-primary)" }}>Canvas Review</div>
          <div style={{ ...MONO, fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            {region && <span style={{ color: "var(--accent)" }}>{region} · </span>}{nodes.length} nodes · {edges.length} edges
            {errors > 0 && <span style={{ color: "var(--danger)" }}> · {errors} errors</span>}
            {warnings > 0 && <span style={{ color: "#fa8c16" }}> · {warnings} warnings</span>}
            {consequences.length > 0 && <span style={{ color: "var(--text-muted)" }}> · {consequences.length} consequences</span>}
          </div>
        </div>
        <span onClick={onClose} style={{ ...MONO, cursor: "pointer", color: "var(--text-muted)", fontSize: 18 }}>✕</span>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        {TABS.map((tab, i) => (
          <div
            key={tab}
            onClick={() => setActiveTab(i)}
            style={{
              ...MONO, fontSize: 11, padding: "10px 16px",
              cursor: "pointer", letterSpacing: 0.5,
              color: activeTab === i ? "var(--accent)" : "var(--text-muted)",
              borderBottom: activeTab === i ? "2px solid var(--accent)" : "2px solid transparent",
              textTransform: "uppercase",
            }}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "0 18px 18px" }}>
        {activeTab === 0 && <SummaryTab ctx={ctx} />}
        {activeTab === 1 && <ConsequencesTab ctx={ctx} />}
        {activeTab === 2 && <HclReadinessTab ctx={ctx} />}
      </div>
    </div>
  );
}