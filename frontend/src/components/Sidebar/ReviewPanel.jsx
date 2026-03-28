import { useState, useRef, useEffect } from "react";
import { buildContext } from "../../config/canvasContext";
import { consequenceRules, CATEGORY_LABELS } from "../../config/consequenceRules";
import { generateHCL } from "../../config/hclGenerator";

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
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          minWidth: 0,
        }}>
          {c.text ?? "—"}
        </span>
      ))}
    </div>
  );
}

function TableHeader({ cols }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: cols.map((c) => c.width || "1fr").join(" "),
      gap: "0 12px",
      padding: "3px 0 4px",
      borderBottom: "1px solid var(--border)",
      marginBottom: 1,
    }}>
      {cols.map((c, i) => (
        <span key={i} style={{
          ...MONO, fontSize: 10,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: 0.8,
          whiteSpace: "nowrap",
        }}>
          {c.text}
        </span>
      ))}
    </div>
  );
}

function SummaryTab({ ctx, roles = [], securityGroups = [] }) {
  const { vpcs, subnets, ec2, rds, lbs, igws, nats, rts, assocEdges, trafficEdges, nodeById, sgById } = ctx;

  const sgNamesForNode = (n) => {
    const ids = n.data?.config?.sg_ids || [];
    if (ids.length === 0) return "—";
    return ids.map((id) => sgById?.(id)?.name || "?").join(", ");
  };
  const s3       = ctx.byResourceType?.["S3"]       || [];
  const ecs      = ctx.byResourceType?.["ECS"]      || [];
  const lambdas  = ctx.byResourceType?.["Lambda"]   || [];
  const dynamo   = ctx.byResourceType?.["DynamoDB"] || [];
  const sqs      = ctx.byResourceType?.["SQS"]      || [];
  const sns      = ctx.byResourceType?.["SNS"]            || [];
  const evb      = ctx.byResourceType?.["EventBridge"]    || [];
  const secrets  = ctx.byResourceType?.["SecretsManager"] || [];
  const apigws   = ctx.byResourceType?.["APIGateway"]     || [];
  const cognitos  = ctx.byResourceType?.["Cognito"]        || [];
  const sfns      = ctx.byResourceType?.["StepFunctions"]  || [];

  return (
    <div style={{ minWidth: 520, overflowX: "auto" }}>
      {vpcs.length > 0 && <>
        <SectionHeader title="VPCs" />
        <TableHeader cols={[{ text: "Name", width: "180px" }, { text: "CIDR", width: "auto" }]} />
        {vpcs.map((n) => (
          <Row key={n.id} cols={[
            { text: n.data.label,        width: "180px" },
            { text: n.data.config?.cidr, width: "auto", dim: true },
          ]} />
        ))}
      </>}

      {subnets.length > 0 && <>
        <SectionHeader title="Subnets" />
        <TableHeader cols={[
          { text: "Name",    width: "130px" },
          { text: "CIDR",    width: "105px" },
          { text: "Type",    width: "55px"  },
          { text: "AZ",      width: "90px"  },
          { text: "VPC",     width: "auto"  },
        ]} />
        {subnets.map((n) => {
          const vpc = nodeById(n.data.config?.vpcId);
          return (
            <Row key={n.id} cols={[
              { text: n.data.label,                    width: "130px" },
              { text: n.data.config?.cidr,             width: "105px", dim: true },
              { text: n.data.config?.visibility,       width: "55px",  dim: true },
              { text: n.data.config?.availability_zone, width: "90px",  dim: true },
              { text: vpc?.data?.label,                width: "auto",  dim: true },
            ]} />
          );
        })}
      </>}

      {ec2.length > 0 && <>
        <SectionHeader title="EC2 Instances" />
        <TableHeader cols={[
          { text: "Name",     width: "120px" },
          { text: "Instance", width: "90px"  },
          { text: "Subnet",   width: "90px"  },
          { text: "SG",       width: "auto"  },
        ]} />
        {ec2.map((n) => {
          const subnet = nodeById(n.data.config?.subnetId);
          return (
            <Row key={n.id} cols={[
              { text: n.data.label,                 width: "120px" },
              { text: n.data.config?.instance_type, width: "90px", dim: true },
              { text: subnet?.data?.label,          width: "90px", dim: true },
              { text: sgNamesForNode(n),            width: "auto", dim: true },
            ]} />
          );
        })}
      </>}

      {rds.length > 0 && <>
        <SectionHeader title="Databases" />
        <TableHeader cols={[
          { text: "Name",    width: "150px" },
          { text: "Engine",  width: "100px" },
          { text: "Subnets", width: "70px"  },
          { text: "Multi-AZ", width: "70px" },
          { text: "SG",      width: "auto"  },
        ]} />
        {rds.map((n) => {
          const rdsSubnets = n.data?.config?.subnets || (n.data?.config?.subnetId ? [n.data.config.subnetId] : []);
          return (
            <Row key={n.id} cols={[
              { text: n.data.label,                                                 width: "150px" },
              { text: `${n.data.config?.engine} ${n.data.config?.engine_version}`, width: "100px", dim: true },
              { text: `${rdsSubnets.length} subnet${rdsSubnets.length !== 1 ? "s" : ""}`, width: "70px", dim: true },
              { text: n.data.config?.multi_az === "true" ? "yes" : "⚠ no",        width: "70px",  dim: n.data.config?.multi_az === "true" },
              { text: sgNamesForNode(n),                                            width: "auto",  dim: true },
            ]} />
          );
        })}
      </>}

      {lbs.length > 0 && <>
        <SectionHeader title="Load Balancers" />
        <TableHeader cols={[
          { text: "Name",    width: "1.4fr" },
          { text: "Type",    width: "0.8fr" },
          { text: "Scheme",  width: "1fr"   },
          { text: "Subnets", width: "0.6fr" },
          { text: "SG",      width: "1fr"   },
        ]} />
        {lbs.map((n) => {
          const subnetIds = n.data?.config?.subnets || [];
          const isNLB = n.data?.config?.load_balancer_type === "network";
          return (
            <Row key={n.id} cols={[
              { text: n.data.label,                          width: "1.4fr" },
              { text: n.data.config?.load_balancer_type,     width: "0.8fr", dim: true },
              { text: n.data.config?.internal === "true" ? "internal" : "internet-facing", width: "1fr", dim: true },
              { text: `${subnetIds.length} subnet${subnetIds.length !== 1 ? "s" : ""}`, width: "0.6fr", dim: true },
              { text: isNLB ? "n/a" : sgNamesForNode(n),    width: "1fr",   dim: true },
            ]} />
          );
        })}

      {securityGroups.length > 0 && <>
        <SectionHeader title="Security Groups" />
        <TableHeader cols={[
          { text: "Name",   width: "1.4fr" },
          { text: "In",     width: "0.4fr" },
          { text: "Out",    width: "0.4fr" },
          { text: "Nodes",  width: "1.2fr" },
        ]} />
        {securityGroups.map((sg) => {
          const assignedNodes = [...ec2, ...rds, ...lbs].filter(
            (n) => (n.data?.config?.sg_ids || []).includes(sg.id)
          );
          // Total inbound = manual + all edge-derived inbound from assigned nodes
          let totalIn  = sg.inbound?.length  || 0;
          let totalOut = sg.outbound?.length || 0;
          assignedNodes.forEach((n) => {
            const result  = ctx.deriveNodeSGs(n.id);
            const primary = result[0];
            if (primary && primary.sg.id === sg.id) {
              totalIn  += primary.edgeDerived.inbound.length;
              totalOut += primary.edgeDerived.outbound.length;
            }
          });
          return (
            <Row key={sg.id} cols={[
              { text: sg.name,                    width: "1.4fr" },
              { text: `${totalIn}`,               width: "0.4fr", dim: true },
              { text: `${totalOut}`,              width: "0.4fr", dim: true },
              { text: assignedNodes.length > 0
                  ? assignedNodes.map((n) => n.data.label).join(", ")
                  : "unassigned",                 width: "1.2fr", dim: true },
            ]} />
          );
        })}
      </>}

      {/* IAM Roles legend */}
      {roles.length > 0 && (
        <>
          <SectionHeader title="IAM Roles" />
          {roles.map((role) => {
            const assignedNodes = ctx.nodes.filter((n) => n.data?.config?.iam_role_id === role.id);
            return (
              <div key={role.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "4px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: role.color, flexShrink: 0, marginTop: 3 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ ...MONO, fontSize: 12, color: "var(--text-primary)", fontWeight: 600 }}>{role.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {role.policies.length} {role.policies.length === 1 ? "policy" : "policies"}
                    {assignedNodes.length > 0 && ` · ${assignedNodes.map((n) => n.data.label).join(", ")}`}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
      </>}

      {igws.length > 0 && <>
        <SectionHeader title="Internet Gateways" />
        <TableHeader cols={[
          { text: "Name", width: "140px" },
          { text: "VPC",  width: "auto"  },
        ]} />
        {igws.map((n) => {
          const vpc = nodeById(n.data.config?.vpcId);
          return (
            <Row key={n.id} cols={[
              { text: n.data.label,     width: "140px" },
              { text: vpc?.data?.label, width: "auto",  dim: true },
            ]} />
          );
        })}
      </>}

      {nats.length > 0 && <>
        <SectionHeader title="NAT Gateways" />
        <TableHeader cols={[
          { text: "Name",         width: "140px" },
          { text: "Connectivity", width: "90px"  },
          { text: "Subnet",       width: "auto"  },
        ]} />
        {nats.map((n) => {
          const subnet = nodeById(n.data.config?.subnetId);
          return (
            <Row key={n.id} cols={[
              { text: n.data.label,                     width: "140px" },
              { text: n.data.config?.connectivity_type, width: "90px",  dim: true },
              { text: subnet?.data?.label,              width: "auto",  dim: true },
            ]} />
          );
        })}
      </>}

      {rts.length > 0 && <>
        <SectionHeader title="Route Tables" />
        <TableHeader cols={[
          { text: "Name",   width: "180px" },
          { text: "Routes", width: "80px"  },
          { text: "VPC",    width: "auto"  },
        ]} />
        {rts.map((n) => {
          const routes = n.data?.config?.routes || [];
          const vpc = nodeById(n.data.config?.vpcId);
          return (
            <Row key={n.id} cols={[
              { text: n.data.label,                                               width: "180px" },
              { text: `${routes.length} route${routes.length !== 1 ? "s" : ""}`, width: "80px", dim: true },
              { text: vpc?.data?.label,                                           width: "auto",  dim: true },
            ]} />
          );
        })}
      </>}

      {s3.length > 0 && <>
        <SectionHeader title="S3 Buckets" />
        <TableHeader cols={[
          { text: "Name",             width: "140px" },
          { text: "Versioning",       width: "80px"  },
          { text: "Encryption",       width: "130px" },
          { text: "Public Access",    width: "auto"  },
        ]} />
        {s3.map((n) => (
          <Row key={n.id} cols={[
            { text: n.data.label,                          width: "140px" },
            { text: n.data.config?.versioning,             width: "80px",  dim: true },
            { text: n.data.config?.encryption,             width: "130px", dim: true },
            { text: n.data.config?.block_public_access === "true" ? "blocked" : "⚠ open", width: "auto", dim: n.data.config?.block_public_access === "true" },
          ]} />
        ))}
      </>}

      {ecs.length > 0 && <>
        <SectionHeader title="ECS Services" />
        <TableHeader cols={[
          { text: "Name",        width: "140px" },
          { text: "Launch",      width: "70px"  },
          { text: "CPU",         width: "60px"  },
          { text: "Memory",      width: "60px"  },
          { text: "Subnets",     width: "60px"  },
          { text: "Count",       width: "auto"  },
        ]} />
        {ecs.map((n) => {
          const ecsSubnets = n.data?.config?.subnets || (n.data?.config?.subnetId ? [n.data.config.subnetId] : []);
          return (
            <Row key={n.id} cols={[
              { text: n.data.label,                    width: "140px" },
              { text: n.data.config?.launch_type,      width: "70px",  dim: true },
              { text: n.data.config?.cpu,              width: "60px",  dim: true },
              { text: n.data.config?.memory,           width: "60px",  dim: true },
              { text: `${ecsSubnets.length} subnet${ecsSubnets.length !== 1 ? "s" : ""}`, width: "60px", dim: true },
              { text: n.data.config?.desired_count,    width: "auto",  dim: true },
            ]} />
          );
        })}
      </>}

      {lambdas.length > 0 && <>
        <SectionHeader title="Lambda Functions" />
        <TableHeader cols={[
          { text: "Name",    width: "140px" },
          { text: "Runtime", width: "110px" },
          { text: "Memory",  width: "70px"  },
          { text: "Timeout", width: "auto"  },
        ]} />
        {lambdas.map((n) => (
          <Row key={n.id} cols={[
            { text: n.data.label,                  width: "140px" },
            { text: n.data.config?.runtime,        width: "110px", dim: true },
            { text: n.data.config?.memory_size ? n.data.config.memory_size + "MB" : "—", width: "70px", dim: true },
            { text: n.data.config?.timeout ? n.data.config.timeout + "s" : "—",          width: "auto",  dim: true },
          ]} />
        ))}
      </>}

      {dynamo.length > 0 && <>
        <SectionHeader title="DynamoDB Tables" />
        <TableHeader cols={[
          { text: "Name",    width: "1.3fr" },
          { text: "Billing", width: "1fr"   },
          { text: "PK",      width: "1fr"   },
          { text: "PITR",    width: "0.5fr" },
        ]} />
        {dynamo.map((n) => (
          <Row key={n.id} cols={[
            { text: n.data.label,                           width: "1.3fr" },
            { text: n.data.config?.billing_mode,            width: "1fr",   dim: true },
            { text: `${n.data.config?.hash_key || "—"} (${n.data.config?.hash_key_type || "?"})`, width: "1fr", dim: true },
            { text: n.data.config?.point_in_time_recovery === "true" ? "on" : "⚠ off", width: "0.5fr", dim: n.data.config?.point_in_time_recovery === "true" },
          ]} />
        ))}
      </>}

      {sqs.length > 0 && <>
        <SectionHeader title="SQS Queues" />
        <TableHeader cols={[
          { text: "Name",  width: "140px" },
          { text: "Type",  width: "80px"  },
          { text: "DLQ",   width: "60px"  },
          { text: "Retention", width: "auto" },
        ]} />
        {sqs.map((n) => (
          <Row key={n.id} cols={[
            { text: n.data.label,                              width: "140px" },
            { text: n.data.config?.fifo === "true" ? "FIFO" : "Standard", width: "80px", dim: true },
            { text: n.data.config?.dlq_enabled === "true" ? "yes" : "⚠ no", width: "60px", dim: n.data.config?.dlq_enabled === "true" },
            { text: n.data.config?.message_retention ? n.data.config.message_retention + "s" : "default", width: "auto", dim: true },
          ]} />
        ))}
      </>}

      {sns.length > 0 && <>
        <SectionHeader title="SNS Topics" />
        <TableHeader cols={[
          { text: "Name",       width: "160px" },
          { text: "Type",       width: "80px"  },
          { text: "Encryption", width: "auto"  },
        ]} />
        {sns.map((n) => (
          <Row key={n.id} cols={[
            { text: n.data.label,                                               width: "160px" },
            { text: n.data.config?.fifo === "true" ? "FIFO" : "Standard",      width: "80px",  dim: true },
            { text: n.data.config?.encryption === "true" ? "SSE-KMS" : "⚠ none", width: "auto", dim: n.data.config?.encryption === "true" },
          ]} />
        ))}
      </>}

      {evb.length > 0 && <>
        <SectionHeader title="EventBridge Buses" />
        <TableHeader cols={[
          { text: "Name",    width: "160px" },
          { text: "Archive", width: "auto"  },
        ]} />
        {evb.map((n) => (
          <Row key={n.id} cols={[
            { text: n.data.label,                                                       width: "160px" },
            { text: n.data.config?.archive_enabled === "true" ? "enabled" : "⚠ none",  width: "auto", dim: n.data.config?.archive_enabled === "true" },
          ]} />
        ))}
      </>}

      {secrets.length > 0 && <>
        <SectionHeader title="Secrets Manager" />
        <TableHeader cols={[
          { text: "Name",     width: "1.4fr" },
          { text: "Rotation", width: "0.8fr" },
          { text: "KMS Key",  width: "1fr"   },
        ]} />
        {secrets.map((n) => (
          <Row key={n.id} cols={[
            { text: n.data.label,                                                        width: "1.4fr" },
            { text: n.data.config?.rotation_enabled === "true" ? "enabled" : "⚠ off",   width: "0.8fr", dim: n.data.config?.rotation_enabled === "true" },
            { text: n.data.config?.kms_key?.trim() || "⚠ default",                       width: "1fr",   dim: !!n.data.config?.kms_key?.trim() },
          ]} />
        ))}
      </>}

      {apigws.length > 0 && <>
        <SectionHeader title="API Gateways" />
        <TableHeader cols={[
          { text: "Name",     width: "160px" },
          { text: "Type",     width: "80px"  },
          { text: "Stage",    width: "80px"  },
          { text: "Throttle", width: "auto"  },
        ]} />
        {apigws.map((n) => (
          <Row key={n.id} cols={[
            { text: n.data.label,                          width: "160px" },
            { text: n.data.config?.api_type,               width: "80px",  dim: true },
            { text: n.data.config?.stage_name || "—",      width: "80px",  dim: true },
            { text: n.data.config?.throttling_rate ? n.data.config.throttling_rate + " r/s" : "⚠ none", width: "auto", dim: !!n.data.config?.throttling_rate },
          ]} />
        ))}
      </>}

      {sfns.length > 0 && <>
        <SectionHeader title="Step Functions" />
        <TableHeader cols={[
          { text: "Name",    width: "160px" },
          { text: "Type",    width: "80px"  },
          { text: "Logging", width: "70px"  },
          { text: "Tracing", width: "auto"  },
        ]} />
        {sfns.map((n) => (
          <Row key={n.id} cols={[
            { text: n.data.label,                                   width: "160px" },
            { text: n.data.config?.type || "—",                     width: "80px",  dim: true },
            { text: n.data.config?.logging_level || "⚠ OFF",        width: "70px",  dim: n.data.config?.logging_level && n.data.config.logging_level !== "OFF" },
            { text: n.data.config?.tracing_enabled === "true" ? "X-Ray" : "off", width: "auto", dim: n.data.config?.tracing_enabled !== "true" },
          ]} />
        ))}
      </>}

      {cognitos.length > 0 && <>
        <SectionHeader title="Cognito User Pools" />
        <TableHeader cols={[
          { text: "Name",  width: "160px" },
          { text: "MFA",   width: "80px"  },
          { text: "Verify", width: "auto" },
        ]} />
        {cognitos.map((n) => (
          <Row key={n.id} cols={[
            { text: n.data.label,                               width: "160px" },
            { text: n.data.config?.mfa_configuration || "—",   width: "80px",  dim: n.data.config?.mfa_configuration !== "ON" },
            { text: n.data.config?.auto_verified_attributes || "—", width: "auto", dim: true },
          ]} />
        ))}
      </>}

      {assocEdges.length > 0 && <>
        <SectionHeader title="Associations" />
        <TableHeader cols={[
          { text: "Source", width: "1.2fr" },
          { text: "",       width: "24px"  },
          { text: "Target", width: "1.2fr" },
        ]} />
        {assocEdges.map((e) => {
          const src = nodeById(e.source);
          const tgt = nodeById(e.target);
          return (
            <Row key={e.id} cols={[
              { text: src?.data?.label, width: "1.2fr" },
              { text: "->",             width: "24px",  dim: true },
              { text: tgt?.data?.label, width: "1.2fr", dim: true },
            ]} />
          );
        })}
      </>}

      {trafficEdges.length > 0 && <>
        <SectionHeader title="Traffic" />
        <TableHeader cols={[
          { text: "Source", width: "160px" },
          { text: "",       width: "36px"  },
          { text: "Target", width: "160px" },
          { text: "Rules",  width: "auto"  },
        ]} />
        {trafficEdges.map((e) => {
          const src = nodeById(e.source);
          const tgt = nodeById(e.target);
          const ing = e.data?.ingress?.length || 0;
          const eg  = e.data?.egress?.length  || 0;
          return (
            <Row key={e.id} cols={[
              { text: src?.data?.label,    width: "160px" },
              { text: "<->",               width: "36px",  dim: true },
              { text: tgt?.data?.label,    width: "160px" },
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
  const { vpcs, subnets, ec2, rds, lbs, igws, nats, rts, assocEdges, anyRtRoutesTo, rtBySubnet, publicSubnets, hasTrafficEdge, hasAnyEdge, nodes, nodeById, roles = [] } = ctx;
  const s3      = ctx.byResourceType?.["S3"]       || [];
  const ecs     = ctx.byResourceType?.["ECS"]      || [];
  const lambdas = ctx.byResourceType?.["Lambda"]   || [];
  const dynamo  = ctx.byResourceType?.["DynamoDB"] || [];
  const sqs     = ctx.byResourceType?.["SQS"]      || [];
  const sns     = ctx.byResourceType?.["SNS"]            || [];
  const evb     = ctx.byResourceType?.["EventBridge"]    || [];
  const secrets = ctx.byResourceType?.["SecretsManager"] || [];
  const apigws       = ctx.byResourceType?.["APIGateway"]     || [];
  const elasticaches = ctx.byResourceType?.["ElastiCache"]    || [];
  const ecrs         = ctx.byResourceType?.["ECR"]            || [];
  const route53s     = ctx.byResourceType?.["Route53"]        || [];
  const kinesises    = ctx.byResourceType?.["Kinesis"]        || [];

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
    const cfg = n.data?.config || {};
    if (!cfg.password)
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing master password` });
    // Handle both subnets[] (new) and subnetId (legacy)
    const rdsSubnets = cfg.subnets?.length > 0 ? cfg.subnets : cfg.subnetId ? [cfg.subnetId] : [];
    if (rdsSubnets.length < 2)
      checks.push({ ok: false, warn: false, message: `${n.data.label} needs at least 2 subnets in different AZs — required for DB Subnet Group` });
    if (!cfg.storage_encrypted)
      checks.push({ ok: false, warn: true, message: `${n.data.label} has no storage encryption — RDS encryption cannot be enabled after creation` });
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


  // ─── IAM hard fails ────────────────────────────────────────────────────────
  const ROLE_NAME_RE = /^[a-zA-Z0-9+=,.@_-]{1,64}$/;
  const roleNames = new Set();
  roles.forEach((role) => {
    // Invalid name chars/length
    if (!ROLE_NAME_RE.test(role.name))
      checks.push({ ok: false, warn: false, message: `IAM role "${role.name}" has invalid characters or exceeds 64 chars — AWS will reject it at apply time` });

    // Duplicate role names
    if (roleNames.has(role.name))
      checks.push({ ok: false, warn: false, message: `Duplicate IAM role name "${role.name}" — generates conflicting aws_iam_role resource names in Terraform` });
    roleNames.add(role.name);

    // Malformed custom ARNs
    role.policies
      .filter((p) => p.startsWith("arn:") && !p.startsWith("arn:aws:iam::aws:policy/"))
      .forEach((arn) => {
        if (!/^arn:aws:iam::\d{12}:policy\/.+/.test(arn))
          checks.push({ ok: false, warn: false, message: `Role "${role.name}" has malformed custom ARN "${arn}" — must be arn:aws:iam::<account-id>:policy/<name>` });
      });
  });

  // Warnings — Terraform applies but may be unintentional
  lbs.forEach((n) => {
    if (!hasTrafficEdge(n.id))
      checks.push({ ok: false, warn: true, message: `${n.data.label} has no traffic connections` });
  });

  // ─── S3 hard fails ─────────────────────────────────────────────────────────
  s3.forEach((b) => {
    const cfg = b.data?.config || {};

    if (!cfg.bucket_name?.trim())
      checks.push({ ok: false, warn: false, message: `${b.data.label} is missing a bucket name — required for aws_s3_bucket resource` });

    if (cfg.acl === "public-read-write" && cfg.block_public_access !== "true")
      checks.push({ ok: false, warn: false, message: `${b.data.label} ACL is public-read-write with Block Public Access disabled — this allows anonymous writes to the bucket` });

    // Warn: encryption off
    if (!cfg.encryption || cfg.encryption === "None")
      checks.push({ ok: false, warn: true, message: `${b.data.label} has no encryption configured — consider enabling SSE-S3 (no added cost)` });

    // Warn: versioning off
    if (cfg.versioning !== "Enabled")
      checks.push({ ok: false, warn: true, message: `${b.data.label} versioning is disabled — object deletions and overwrites are irreversible` });

    // Warn: force_destroy in production
    if (cfg.force_destroy === "true")
      checks.push({ ok: false, warn: true, message: `${b.data.label} has force_destroy enabled — all objects will be destroyed on terraform destroy` });
  });

  // ─── ECS hard fails ────────────────────────────────────────────────────────
  ecs.forEach((n) => {
    const cfg = n.data?.config || {};
    // Handle both subnets[] (new) and subnetId (legacy single)
    const hasSubnet = cfg.subnets?.length > 0 || !!cfg.subnetId;
    if (!hasSubnet)
      checks.push({ ok: false, warn: false, message: `${n.data.label} has no subnet assigned — required for ECS task networking` });
    if (!cfg.image?.trim())
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing a container image — required for task definition` });
    if (!cfg.desired_count?.toString().trim())
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing desired count` });
    if (!cfg.cpu)
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing CPU allocation` });
    if (!cfg.memory)
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing memory allocation` });
    if (parseInt(cfg.desired_count, 10) === 0)
      checks.push({ ok: false, warn: true, message: `${n.data.label} desired count is 0 — service will be created but no tasks will run` });
  });

  // ─── Lambda hard fails ─────────────────────────────────────────────────────
  lambdas.forEach((n) => {
    const cfg = n.data?.config || {};
    if (!cfg.handler?.trim())
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing handler — required (e.g. index.handler)` });
    if (!cfg.runtime)
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing runtime` });
    if (!cfg.iam_role_id)
      checks.push({ ok: false, warn: false, message: `${n.data.label} has no execution role — Lambda cannot be created without an IAM role` });
    if (cfg.vpc_enabled === "true" && !cfg.subnetId)
      checks.push({ ok: false, warn: false, message: `${n.data.label} has VPC enabled but no subnet selected` });
  });

  // ─── DynamoDB hard fails ───────────────────────────────────────────────────
  dynamo.forEach((n) => {
    const cfg = n.data?.config || {};
    if (!cfg.table_name?.trim())
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing a table name` });
    if (!cfg.hash_key?.trim())
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing a partition key (PK)` });
    if (cfg.range_key?.trim() && !cfg.range_key_type)
      checks.push({ ok: false, warn: false, message: `${n.data.label} has a sort key but no sort key type selected` });
    if (!cfg.point_in_time_recovery || cfg.point_in_time_recovery !== "true")
      checks.push({ ok: false, warn: true, message: `${n.data.label} has PITR disabled — enable for production tables` });
  });

  // ─── SQS hard fails ────────────────────────────────────────────────────────
  sqs.forEach((n) => {
    const cfg = n.data?.config || {};
    if (!cfg.queue_name?.trim())
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing a queue name` });
    if (cfg.fifo === "true" && !cfg.queue_name?.endsWith(".fifo"))
      checks.push({ ok: false, warn: false, message: `${n.data.label} is a FIFO queue but name doesn't end in ".fifo" — AWS will reject this` });
    if (!cfg.dlq_enabled || cfg.dlq_enabled !== "true")
      checks.push({ ok: false, warn: true, message: `${n.data.label} has no Dead Letter Queue — failed messages will be silently dropped` });
  });

  // ─── SNS hard fails ────────────────────────────────────────────────────────
  sns.forEach((n) => {
    const cfg = n.data?.config || {};
    if (!cfg.topic_name?.trim())
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing a topic name` });
    if (cfg.fifo === "true" && !cfg.topic_name?.endsWith(".fifo"))
      checks.push({ ok: false, warn: false, message: `${n.data.label} is a FIFO topic but name doesn't end in ".fifo"` });
  });

  // ─── EventBridge hard fails ─────────────────────────────────────────────
  evb.forEach((n) => {
    const cfg = n.data?.config || {};
    if (!cfg.bus_name?.trim())
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing a bus name` });
  });

  // ─── Secrets Manager hard fails ─────────────────────────────────────────
  secrets.forEach((n) => {
    const cfg = n.data?.config || {};
    if (!cfg.secret_name?.trim())
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing a secret name` });
  });

  // ─── API Gateway hard fails ──────────────────────────────────────────────
  apigws.forEach((n) => {
    const cfg = n.data?.config || {};
    if (!cfg.api_name?.trim())
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing an API name` });
    if (!cfg.stage_name?.trim())
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing a stage name` });
    if (!cfg.api_type)
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing API type` });
  });

  // ─── ElastiCache hard fails ────────────────────────────────────────────────
  elasticaches.forEach((n) => {
    const cfg = n.data?.config || {};
    if (!cfg.engine)
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing engine (Redis or Memcached)` });
    if (!cfg.node_type?.trim())
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing node type` });
    const ecSubnets = cfg.subnets || [];
    if (ecSubnets.length < 2)
      checks.push({ ok: false, warn: false, message: `${n.data.label} needs at least 2 subnets in different AZs — required for subnet group` });
    if (ecSubnets.length >= 2) {
      const azs = ecSubnets.map((id) => nodeById(id)?.data?.config?.availability_zone).filter(Boolean);
      if (new Set(azs).size < 2)
        checks.push({ ok: false, warn: false, message: `${n.data.label} subnets must be in at least 2 different Availability Zones` });
    }
  });

  // ─── ECR hard fails ──────────────────────────────────────────────────────
  ecrs.forEach((n) => {
    const cfg = n.data?.config || {};
    if (!cfg.repository_name?.trim())
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing a repository name` });
  });

  // ─── Route 53 hard fails ─────────────────────────────────────────────────
  route53s.forEach((n) => {
    const cfg = n.data?.config || {};
    if (!cfg.hosted_zone_name?.trim())
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing a hosted zone name` });
    if (!cfg.zone_type)
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing zone type (public/private)` });
    if (cfg.zone_type === "private" && !cfg.vpcId)
      checks.push({ ok: false, warn: false, message: `${n.data.label} is a private zone but has no VPC selected — AWS requires at least one VPC association` });
  });

  // ─── Kinesis hard fails ──────────────────────────────────────────────────
  kinesises.forEach((n) => {
    const cfg = n.data?.config || {};
    if (!cfg.stream_name?.trim())
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing a stream name` });
    if (!cfg.stream_mode)
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing capacity mode (Provisioned/On-Demand)` });
    if (cfg.stream_mode === "PROVISIONED" && (!cfg.shard_count || parseInt(cfg.shard_count, 10) < 1))
      checks.push({ ok: false, warn: false, message: `${n.data.label} is provisioned but has no shard count — at least 1 shard is required` });
  });

  // ─── ACM hard fails ────────────────────────────────────────────────────────
  const acms = ctx.byResourceType?.["ACM"] || [];
  acms.forEach((n) => {
    const cfg = n.data?.config || {};
    if (!cfg.domain_name?.trim())
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing a domain name` });
    if (!cfg.validation_method)
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing a validation method` });
  });

  // ─── CloudFront hard fails ────────────────────────────────────────────────
  const cfs = ctx.byResourceType?.["CloudFront"] || [];
  cfs.forEach((n) => {
    const cfg = n.data?.config || {};
    if (!cfg.origin_id && !cfg.custom_origin?.trim())
      checks.push({ ok: false, warn: false, message: `${n.data.label} has no origin configured` });
  });

  // ─── WAF hard fails ──────────────────────────────────────────────────────
  const wafs = ctx.byResourceType?.["WAF"] || [];
  wafs.forEach((n) => {
    const cfg = n.data?.config || {};
    if (!cfg.waf_name?.trim())
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing a Web ACL name` });
    if (!cfg.default_action)
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing a default action (allow/block)` });
  });

  // ─── ASG hard fails ──────────────────────────────────────────────────────
  const asgs = ctx.byResourceType?.["ASG"] || [];
  asgs.forEach((n) => {
    const cfg = n.data?.config || {};
    if (!(cfg.subnets || []).length)
      checks.push({ ok: false, warn: false, message: `${n.data.label} has no subnets` });
    if (!cfg.ami?.trim())
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing an AMI` });
    if (!cfg.instance_type?.trim())
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing an instance type` });
    if (!cfg.min_size || !cfg.max_size || !cfg.desired_capacity)
      checks.push({ ok: false, warn: false, message: `${n.data.label} is missing scaling parameters (min/max/desired)` });
  });

  // ─── Orphan check — exclude intentionally edgeless global services ─────────
  const EDGELESS_TYPES = ["Public", "S3", "DynamoDB", "SQS", "SNS", "EventBridge", "SecretsManager", "ECR", "ACM", "WAF"];
  nodes.forEach((n) => {
    if (EDGELESS_TYPES.includes(n.data?.resourceType)) return;
    if (!hasAnyEdge(n.id))
      checks.push({ ok: false, warn: true, message: `${n.data.label} is orphaned (no edges)` });
  });

  if (checks.length === 0)
    checks.push({ ok: true, warn: false, message: "Canvas is ready for HCL export" });

  return checks;
}

function HclReadinessTab({ ctx, region }) {
  const checks = buildHclChecks(ctx);
  const [hcl, setHcl] = useState(null);
  const [reverseMap, setReverseMap] = useState({});
  const [genWarnings, setGenWarnings] = useState([]);
  const [copied, setCopied] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState(null); // { valid, diagnostics, mode }
  const [serverMode, setServerMode] = useState(null); // what the server has: "terraform" | "hcl2" | "none"
  const [selectedMode, setSelectedMode] = useState("auto"); // user choice: "auto" | "terraform" | "hcl2"
  const codeRef = useRef(null);

  useEffect(() => {
    fetch("/api/validation-mode")
      .then((r) => r.json())
      .then((data) => setServerMode(data.mode))
      .catch(() => setServerMode("none"));
  }, []);

  const hasHardErrors = checks.some((c) => !c.ok && !c.warn);

  const handleGenerate = () => {
    const result = generateHCL(ctx, region);
    setHcl(result.hcl);
    setReverseMap(result.reverse || {});
    setGenWarnings(result.warnings || []);
    setValidation(null);
  };

  const handleValidate = async () => {
    if (!hcl) return;
    setValidating(true);
    setValidation(null);
    try {
      const res = await fetch("/api/validate-hcl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hcl, reverse: reverseMap, mode: selectedMode }),
      });
      const data = await res.json();
      setValidation(data);
    } catch (err) {
      setValidation({
        valid: false,
        mode: "none",
        fallback: false,
        diagnostics: [{
          severity: "error",
          summary: "Backend unreachable",
          detail: "Could not connect to the backend server. Is it running on port 8000?",
          resource: null,
          nodeId: null,
        }],
      });
    } finally {
      setValidating(false);
    }
  };

  const handleCopy = async () => {
    if (!hcl) return;
    try {
      await navigator.clipboard.writeText(hcl);
    } catch {
      // Fallback for non-HTTPS contexts
      const textarea = document.createElement("textarea");
      textarea.value = hcl;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!hcl) return;
    const blob = new Blob([hcl], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "main.tf";
    a.click();
    URL.revokeObjectURL(url);
  };

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

      {/* Generate button */}
      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button
          onClick={handleGenerate}
          disabled={hasHardErrors}
          style={{
            ...MONO, fontSize: 12, padding: "8px 16px",
            background: hasHardErrors ? "var(--bg-elevated)" : "var(--accent)",
            color: hasHardErrors ? "var(--text-muted)" : "#fff",
            border: "1px solid var(--border)",
            borderRadius: 4, cursor: hasHardErrors ? "not-allowed" : "pointer",
            opacity: hasHardErrors ? 0.5 : 1,
          }}
        >
          {hasHardErrors ? "Fix errors to generate" : "Generate HCL"}
        </button>

        {hcl && (
          <>
            <button onClick={handleCopy} style={{
              ...MONO, fontSize: 12, padding: "8px 12px",
              background: "var(--bg-elevated)", color: "var(--text-primary)",
              border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer",
            }}>
              {copied ? "Copied!" : "Copy"}
            </button>
            <button onClick={handleDownload} style={{
              ...MONO, fontSize: 12, padding: "8px 12px",
              background: "var(--bg-elevated)", color: "var(--text-primary)",
              border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer",
            }}>
              Download .tf
            </button>
            <button
              onClick={handleValidate}
              disabled={validating || serverMode === "none"}
              style={{
                ...MONO, fontSize: 12, padding: "8px 12px",
                background: validating ? "var(--bg-elevated)" : "#1a1a2e",
                color: validating ? "var(--text-muted)" : "#a78bfa",
                border: "1px solid #a78bfa44",
                borderRadius: 4,
                cursor: validating || serverMode === "none" ? "not-allowed" : "pointer",
                opacity: validating || serverMode === "none" ? 0.6 : 1,
              }}
            >
              {validating ? "Validating..." : "Validate"}
            </button>
            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value)}
              style={{
                ...MONO, fontSize: 11, padding: "6px 8px",
                background: "var(--bg-elevated)", color: "var(--text-primary)",
                border: "1px solid var(--border)", borderRadius: 4,
                cursor: "pointer",
              }}
            >
              <option value="auto">auto</option>
              {serverMode === "terraform" && <option value="terraform">terraform</option>}
              {(serverMode === "terraform" || serverMode === "hcl2") && <option value="hcl2">hcl2</option>}
            </select>
          </>
        )}
      </div>

      {/* Validation mode indicator */}
      {hcl && serverMode && (
        <div style={{
          ...MONO, fontSize: 10, marginTop: 8, padding: "4px 8px",
          background: serverMode === "terraform" ? "#0a2e1a" : serverMode === "hcl2" ? "#2e2a0a" : "#2e0a0a",
          border: `1px solid ${serverMode === "terraform" ? "#2d6a4f" : serverMode === "hcl2" ? "#6a5f2d" : "#6a2d2d"}`,
          borderRadius: 3, display: "inline-block",
          color: serverMode === "terraform" ? "#52c41a" : serverMode === "hcl2" ? "#faad14" : "#ff4d4f",
        }}>
          {serverMode === "terraform" && `server: terraform available | using: ${selectedMode}`}
          {serverMode === "hcl2" && `server: hcl2 only (terraform not available) | using: ${selectedMode}`}
          {serverMode === "none" && "no validation engine available"}
        </div>
      )}

      {/* Reference warnings */}
      {genWarnings.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {genWarnings.map((w, i) => (
            <div key={i} style={{
              ...MONO, fontSize: 11, color: "#fa8c16",
              padding: "4px 0", lineHeight: 1.5,
            }}>
              [ref] {w}
            </div>
          ))}
        </div>
      )}

      {/* Terraform validation results */}
      {validation && (
        <div style={{
          marginTop: 12, padding: 12,
          background: validation.valid ? "#0a2e1a" : "#2e0a0a",
          border: `1px solid ${validation.valid ? "#2d6a4f" : "#6a2d2d"}`,
          borderRadius: 4,
        }}>
          <div style={{
            ...MONO, fontSize: 12, fontWeight: 600,
            color: validation.valid ? "#52c41a" : "#ff4d4f",
            marginBottom: validation.diagnostics?.length ? 8 : 0,
          }}>
            {validation.valid
              ? `${validation.mode === "hcl2" ? "hcl2 syntax check" : "terraform validate"}: PASSED`
              : `${validation.mode === "none" ? "validation" : validation.mode === "hcl2" ? "hcl2 syntax check" : "terraform validate"}: FAILED`
            }
            {validation.fallback && (
              <span style={{ color: "#faad14", fontWeight: 400, fontSize: 10, marginLeft: 8 }}>
                (fallback)
              </span>
            )}
          </div>
          {(validation.diagnostics || []).map((d, i) => (
            <div key={i} style={{
              ...MONO, fontSize: 11, lineHeight: 1.5,
              padding: "6px 0",
              borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
              color: d.severity === "error" ? "#ff7875" : "#faad14",
            }}>
              <div style={{ fontWeight: 600 }}>
                [{d.severity}] {d.summary}
                {d.nodeId && (
                  <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                    {" "}(node: {d.nodeId})
                  </span>
                )}
              </div>
              {d.detail && (
                <div style={{ color: "var(--text-muted)", marginTop: 2, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {d.detail}
                </div>
              )}
              {d.resource && (
                <div style={{ color: "var(--text-muted)", marginTop: 2 }}>
                  Resource: {d.resource}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* HCL output */}
      {hcl && (
        <pre ref={codeRef} style={{
          ...MONO, fontSize: 11, lineHeight: 1.5,
          marginTop: 12, padding: 12,
          background: "var(--bg-base)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          overflowX: "auto",
          whiteSpace: "pre",
          color: "var(--text-primary)",
          maxHeight: "60vh",
        }}>
          {hcl}
        </pre>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function ReviewPanel({ nodes, edges, onClose, region, roles = [], securityGroups = [], width = 440, onStartDrag }) {
  const [activeTab, setActiveTab] = useState(0);
  const ctx = buildContext(nodes, edges, roles, securityGroups);

  const hclChecks  = buildHclChecks(ctx);
  const errors     = hclChecks.filter((c) => !c.ok && !c.warn).length;
  const warnings   = hclChecks.filter((c) => !c.ok && c.warn).length;

  const consequences = [];
  consequenceRules.forEach((rule) => {
    try { consequences.push(...rule.check(ctx)); } catch (e) { console.warn(`[consequence rule ${rule.id}] failed:`, e.message); }
  });

  return (
    <div style={{
      position: "absolute", top: 0, right: 0,
      width, minWidth: 360, maxWidth: 640,
      height: "100%",
      background: "var(--bg-surface)",
      borderLeft: "1px solid var(--border)",
      zIndex: 20, display: "flex", flexDirection: "column",
      boxShadow: "-4px 0 24px rgba(0,0,0,0.3)",
    }}>
      {/* Drag handle — left edge */}
      <div
        onMouseDown={onStartDrag}
        style={{
          position: "absolute", top: 0, left: -3,
          width: 6, height: "100%",
          cursor: "col-resize", zIndex: 10,
        }}
      />
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
      <div style={{ flex: 1, overflowY: "auto", padding: "0 18px 18px" }}>
        {activeTab === 0 && <SummaryTab ctx={ctx} roles={roles} securityGroups={securityGroups} />}
        {activeTab === 1 && <ConsequencesTab ctx={ctx} />}
        {activeTab === 2 && <HclReadinessTab ctx={ctx} region={region} />}
      </div>
    </div>
  );
}