/**
 * Consequence rules — declarative config describing what the architecture
 * does and doesn't do. Each rule receives the full canvas context and returns
 * an array of consequence strings (one per affected resource), or empty if clean.
 *
 * severity: "consequence" | "risk" | "cost"
 * category: "connectivity" | "security" | "availability" | "cost" | "smell"
 */

export const consequenceRules = [

  // ─── DEPRECATED ────────────────────────────────────────────────────────────

  {
    id: "public_node_deprecated",
    category: "deprecated",
    check: ({ publics }) =>
      publics.length > 0
        ? [{
            node: null,
            message: "Public / Internet node is deprecated — internet exposure is now derived from subnet visibility and Route Table → IGW configuration. Remove the Public node and ensure your public subnets have a Route Table with a 0.0.0.0/0 → IGW route.",
          }]
        : [],
  },

  // ─── CONNECTIVITY ──────────────────────────────────────────────────────────

  {
    id: "vpc_no_igw",
    category: "connectivity",
    check: ({ vpcs, igws, publicSubnets }) =>
      vpcs
        .filter((vpc) => !igws.some((igw) => igw.data?.config?.vpcId === vpc.id))
        .map((vpc) => {
          const hasPublic = publicSubnets.some((s) => s.data?.config?.vpcId === vpc.id);
          return {
            node: vpc,
            message: hasPublic
              ? `${vpc.data.label} has public subnets but no IGW — internet traffic impossible`
              : `${vpc.data.label} has no IGW — VPC is fully isolated from internet`,
          };
        }),
  },

  {
    id: "public_subnet_no_igw_route",
    category: "connectivity",
    check: ({ publicSubnets, igws, rtBySubnet, rts, rtRoutesTo }) =>
      publicSubnets
        .filter((s) => {
          const rt = rtBySubnet[s.id];
          if (!rt) return false; // no RT at all — caught by separate check
          return !igws.some((igw) => rtRoutesTo(rt, igw.id));
        })
        .map((s) => ({
          node: s,
          message: `${s.data.label} is public but its Route Table has no route to an IGW`,
        })),
  },

  {
    id: "private_subnet_no_nat_route",
    category: "connectivity",
    check: ({ privateSubnets, nats, rtBySubnet, rtRoutesTo }) =>
      privateSubnets
        .filter((s) => {
          const rt = rtBySubnet[s.id];
          if (!rt) return false;
          return !nats.some((nat) => rtRoutesTo(rt, nat.id));
        })
        .map((s) => ({
          node: s,
          message: `${s.data.label} has no NAT route — add a 0.0.0.0/0 route in its Route Table pointing to a NAT Gateway in a public subnet`,
        })),
  },

  {
    id: "nat_in_wrong_subnet",
    category: "connectivity",
    check: ({ nats, nodeById }) =>
      nats
        .filter((nat) => {
          const subnet = nodeById(nat.data?.config?.subnetId);
          return subnet?.data?.config?.visibility !== "Public";
        })
        .map((nat) => ({
          node: nat,
          message: `${nat.data.label} is not in a public subnet — NAT will not function`,
        })),
  },

  {
    id: "lb_no_targets",
    category: "connectivity",
    check: ({ lbs, trafficNeighbors }) =>
      lbs
        .filter((lb) => {
          const neighbors = trafficNeighbors(lb.id);
          return !neighbors.some((n) => n?.data?.resourceType === "EC2");
        })
        .map((lb) => ({
          node: lb,
          message: `${lb.data.label} has no EC2 targets — will return 502 to all requests`,
        })),
  },

  {
    id: "ec2_direct_public_no_lb",
    category: "connectivity",
    check: ({ ec2, lbs, trafficNeighbors, publicSubnets, nodeById }) =>
      ec2
        .filter((instance) => {
          const subnet = nodeById(instance.data?.config?.subnetId);
          const isPublic = publicSubnets.some((s) => s.id === subnet?.id);
          const neighbors = trafficNeighbors(instance.id);
          const hasPublicNeighbor = neighbors.some((n) => n?.data?.resourceType === "Public");
          const hasLbNeighbor = neighbors.some((n) => n?.data?.resourceType === "LoadBalancer");
          return isPublic && hasPublicNeighbor && !hasLbNeighbor;
        })
        .map((instance) => ({
          node: instance,
          message: `${instance.data.label} is directly internet-facing — consider placing behind a Load Balancer`,
        })),
  },

  {
    id: "multiple_ec2_no_lb",
    category: "connectivity",
    check: ({ ec2, lbs }) =>
      ec2.length > 1 && lbs.length === 0
        ? [{ node: null, message: `${ec2.length} EC2 instances with no Load Balancer — traffic cannot be distributed` }]
        : [],
  },

  // ─── SECURITY ──────────────────────────────────────────────────────────────

  {
    id: "rds_in_public_subnet",
    category: "security",
    check: ({ rds, publicSubnets, nodeById }) =>
      rds
        .filter((db) => {
          const subnet = nodeById(db.data?.config?.subnetId);
          return publicSubnets.some((s) => s.id === subnet?.id);
        })
        .map((db) => ({
          node: db,
          message: `${db.data.label} is in a public subnet — databases should always be in private subnets`,
        })),
  },

  {
    id: "rds_no_traffic_rules",
    category: "security",
    check: ({ rds, hasTrafficEdge }) =>
      rds
        .filter((db) => !hasTrafficEdge(db.id))
        .map((db) => ({
          node: db,
          message: `${db.data.label} has no traffic rules — access is unrestricted at network level`,
        })),
  },

  {
    id: "ec2_public_no_traffic_rules",
    category: "security",
    check: ({ ec2, rds, lbs, hasTrafficEdge, nodeById }) =>
      [...ec2, ...rds, ...lbs]
        .filter((n) => !hasTrafficEdge(n.id))
        .map((n) => ({
          node: n,
          message: `${n.data.label} has no explicit security group rules — AWS default SG will apply (all inbound blocked, all outbound allowed)`,
        })),
  },

  {
    id: "no_private_subnet",
    category: "security",
    check: ({ privateSubnets, vpcs }) =>
      vpcs
        .filter((vpc) => !privateSubnets.some((s) => s.data?.config?.vpcId === vpc.id))
        .map((vpc) => ({
          node: vpc,
          message: `${vpc.data.label} has no private subnet — all resources are internet-exposed`,
        })),
  },

  {
    id: "ec2_rds_same_subnet",
    category: "security",
    check: ({ ec2, rds, nodeById }) => {
      const results = [];
      ec2.forEach((instance) => {
        const subnetId = instance.data?.config?.subnetId;
        const colocated = rds.filter((db) => db.data?.config?.subnetId === subnetId);
        colocated.forEach((db) => {
          results.push({
            node: instance,
            message: `${instance.data.label} and ${db.data.label} share a subnet — no network segmentation between compute and database`,
          });
        });
      });
      return results;
    },
  },

  // ─── AVAILABILITY ──────────────────────────────────────────────────────────

  {
    id: "single_subnet",
    category: "availability",
    check: ({ vpcs, subnetsByVpc }) =>
      vpcs
        .filter((vpc) => (subnetsByVpc[vpc.id] || []).length === 1)
        .map((vpc) => ({
          node: vpc,
          message: `${vpc.data.label} has a single subnet — entire VPC in one AZ, outage takes down everything`,
        })),
  },

  {
    id: "rds_no_multi_az",
    category: "availability",
    check: ({ rds }) =>
      rds
        .filter((db) => db.data?.config?.multi_az !== "true")
        .map((db) => ({
          node: db,
          message: `${db.data.label} has Multi-AZ disabled — an AZ failure causes downtime until manual restore`,
        })),
  },

  {
    id: "single_nat",
    category: "availability",
    check: ({ nats, privateSubnets }) =>
      nats.length === 1 && privateSubnets.length > 1
        ? [{ node: nats[0], message: `Single NAT Gateway serving ${privateSubnets.length} private subnets — NAT failure cuts all outbound internet` }]
        : [],
  },

  {
    id: "lb_single_target",
    category: "availability",
    check: ({ lbs, trafficNeighbors }) =>
      lbs
        .filter((lb) => {
          const ec2Targets = trafficNeighbors(lb.id).filter((n) => n?.data?.resourceType === "EC2");
          return ec2Targets.length === 1;
        })
        .map((lb) => ({
          node: lb,
          message: `${lb.data.label} has only one EC2 target — load balancer provides no actual redundancy`,
        })),
  },

  // ─── LOAD BALANCER ────────────────────────────────────────────────────────

  {
    id: "nlb_no_sg",
    category: "connectivity",
    check: ({ lbs }) =>
      lbs
        .filter((lb) => lb.data?.config?.load_balancer_type === "network")
        .map((lb) => ({
          node: lb,
          message: `${lb.data.label} is an NLB — it has no security group. Traffic rules must be defined on target EC2 instances directly`,
        })),
  },

  {
    id: "lb_internet_facing_private_subnets",
    category: "connectivity",
    check: ({ lbs, privateSubnets, nodeById }) =>
      lbs
        .filter((lb) => {
          if (lb.data?.config?.internal === "true") return false;
          const subnetIds = lb.data?.config?.subnets || [];
          return subnetIds.length > 0 && subnetIds.every((id) =>
            privateSubnets.some((ps) => ps.id === id)
          );
        })
        .map((lb) => ({
          node: lb,
          message: `${lb.data.label} is internet-facing but all selected subnets are private — it will not be reachable from the internet`,
        })),
  },

  {
    id: "lb_internal_public_subnets",
    category: "connectivity",
    check: ({ lbs, publicSubnets }) =>
      lbs
        .filter((lb) => {
          if (lb.data?.config?.internal !== "true") return false;
          const subnetIds = lb.data?.config?.subnets || [];
          return subnetIds.some((id) => publicSubnets.some((ps) => ps.id === id));
        })
        .map((lb) => ({
          node: lb,
          message: `${lb.data.label} is internal but placed in public subnets — consider using private subnets for internal load balancers`,
        })),
  },

  {
    id: "lb_subnets_same_az",
    category: "availability",
    check: ({ lbs, nodeById }) => {
      const results = [];
      lbs.forEach((lb) => {
        const subnetIds = lb.data?.config?.subnets || [];
        const azs = subnetIds
          .map((id) => nodeById(id)?.data?.config?.availability_zone)
          .filter(Boolean);
        const uniqueAzs = new Set(azs);
        if (subnetIds.length >= 2 && uniqueAzs.size < 2) {
          results.push({
            node: lb,
            message: `${lb.data.label} subnets are all in the same AZ — load balancer requires subnets in at least 2 different AZs for high availability`,
          });
        }
      });
      return results;
    },
  },

  // ─── COST ──────────────────────────────────────────────────────────────────

  {
    id: "nat_gateway_cost",
    category: "cost",
    check: ({ nats }) =>
      nats.map((nat) => ({
        node: nat,
        message: `${nat.data.label} — ~$0.045/hr + $0.045/GB data processed`,
      })),
  },

  {
    id: "nat_eip_cost",
    category: "cost",
    check: ({ nats }) =>
      nats
        .filter((nat) => nat.data?.config?.allocate_eip === "true")
        .map((nat) => ({
          node: nat,
          message: `${nat.data.label} allocates an Elastic IP — charged when NAT is stopped`,
        })),
  },

  {
    id: "multiple_nats_cost",
    category: "cost",
    check: ({ nats }) =>
      nats.length > 1
        ? [{ node: null, message: `${nats.length} NAT Gateways — consider one shared NAT to reduce hourly charges` }]
        : [],
  },

  {
    id: "lb_cost",
    category: "cost",
    check: ({ lbs }) =>
      lbs.map((lb) => ({
        node: lb,
        message: `${lb.data.label} — ~$0.008/hr + LCU charges`,
      })),
  },

  {
    id: "rds_multi_az_cost",
    category: "cost",
    check: ({ rds }) =>
      rds
        .filter((db) => db.data?.config?.multi_az === "true")
        .map((db) => ({
          node: db,
          message: `${db.data.label} has Multi-AZ enabled — doubles RDS instance cost`,
        })),
  },

  {
    id: "aurora_cost",
    category: "cost",
    check: ({ rds }) =>
      rds
        .filter((db) => db.data?.config?.engine?.startsWith("aurora"))
        .map((db) => ({
          node: db,
          message: `${db.data.label} uses Aurora — higher base cost than standard ${db.data.config?.engine?.includes("mysql") ? "MySQL" : "PostgreSQL"}`,
        })),
  },

  {
    id: "mixed_visibility_same_rt",
    category: "connectivity",
    check: ({ rts, subnetsByRt, publicSubnets, privateSubnets }) => {
      const results = [];
      rts.forEach((rt) => {
        const associated = subnetsByRt[rt.id] || [];
        const hasPublic  = associated.some((s) => publicSubnets.some((ps) => ps.id === s.id));
        const hasPrivate = associated.some((s) => privateSubnets.some((pv) => pv.id === s.id));
        if (hasPublic && hasPrivate) {
          results.push({
            node: rt,
            message: `${rt.data.label} is shared between public and private subnets — they need separate route tables since each requires a different default route (IGW vs NAT)`,
          });
        }
      });
      return results;
    },
  },

  // ─── ARCHITECTURE SMELLS ───────────────────────────────────────────────────

  {
    id: "rt_default_route_wrong_target",
    category: "smell",
    check: ({ rts, nats, publicSubnets, subnetsByRt, nodeById }) => {
      const results = [];
      rts.forEach((rt) => {
        const associatedSubnets = subnetsByRt[rt.id] || [];
        const isPublicRt = associatedSubnets.some((s) =>
          publicSubnets.some((ps) => ps.id === s.id)
        );
        const routes = rt.data?.config?.routes || [];
        routes.forEach((r) => {
          if (r.destination === "0.0.0.0/0") {
            const target = nodeById(r.target);
            const targetIsNat = target?.data?.resourceType === "NATGateway";
            if (isPublicRt && targetIsNat) {
              results.push({
                node: rt,
                message: `${rt.data.label} is a public RT with default route to NAT — public subnets should route to IGW`,
              });
            }
          }
        });
      });
      return results;
    },
  },

  {
    id: "rds_bidirectional_traffic",
    category: "smell",
    check: ({ rds, trafficEdges }) =>
      rds
        .filter((db) =>
          trafficEdges.some((e) => {
            const hasEgress = e.data?.egress?.length > 0;
            return (e.source === db.id || e.target === db.id) && hasEgress;
          })
        )
        .map((db) => ({
          node: db,
          message: `${db.data.label} has egress rules — databases should only receive connections, not initiate them`,
        })),
  },

  {
    id: "orphaned_node",
    category: "smell",
    check: ({ nodes, edges }) => {
      // These types are intentionally edgeless — accessed via IAM policies, not network edges
      const EDGELESS_TYPES = ["Public", "S3", "DynamoDB", "SQS", "Lambda"];
      return nodes
        .filter((n) => {
          if (EDGELESS_TYPES.includes(n.data?.resourceType)) return false;
          return !edges.some((e) => e.source === n.id || e.target === n.id);
        })
        .map((n) => ({
          node: n,
          message: `${n.data.label} has no connections — resource will be created but isolated`,
        }));
    },
  },


  // ─── SECURITY GROUPS ──────────────────────────────────────────────────────

  {
    id: "sg_missing",
    category: "security",
    check: ({ nodesWithoutSG, securityGroups }) => {
      // Only fire if at least one SG has been defined on the canvas
      if ((securityGroups || []).length === 0) return [];
      return nodesWithoutSG
        .map((n) => ({
          node: n,
          message: `${n.data.label} has no Security Group assigned — AWS default SG applies (all inbound blocked, all outbound allowed). Assign a Security Group in the Configure tab.`,
        }));
    },
  },

  {
    id: "sg_defined_unassigned",
    category: "smell",
    check: ({ securityGroups, nodesWithSG }) => {
      const assignedIds = new Set(
        nodesWithSG.flatMap((n) => n.data?.config?.sg_ids || [])
      );
      return securityGroups
        .filter((sg) => !assignedIds.has(sg.id))
        .map((sg) => ({
          node: null,
          message: `Security Group "${sg.name}" is defined but not assigned to any node — will generate a dead aws_security_group resource in Terraform`,
        }));
    },
  },

  {
    id: "sg_wide_open_ssh",
    category: "security",
    check: ({ securityGroups, nodesWithSG, nodeById }) => {
      const results = [];
      nodesWithSG.forEach((node) => {
        const sgIds = node.data?.config?.sg_ids || [];
        sgIds.forEach((sgId) => {
          const sg = securityGroups.find((s) => s.id === sgId);
          if (!sg) return;
          const sshRule = (sg.inbound || []).find(
            (r) => (r.port === "22" || r.port === "3389") &&
                   (r.cidr === "0.0.0.0/0" || r.cidr === "::/0")
          );
          if (sshRule) {
            results.push({
              node,
              message: `${node.data.label} SG "${sg.name}" allows SSH/RDP (port ${sshRule.port}) from 0.0.0.0/0 — restrict to a known CIDR range`,
            });
          }
        });
      });
      return results;
    },
  },

  {
    id: "sg_nlb_assigned",
    category: "smell",
    check: ({ lbs, securityGroups }) =>
      lbs
        .filter((lb) =>
          lb.data?.config?.load_balancer_type === "network" &&
          (lb.data?.config?.sg_ids || []).length > 0
        )
        .map((lb) => ({
          node: lb,
          message: `${lb.data.label} is an NLB — NLBs do not support Security Groups. Remove the SG assignment.`,
        })),
  },

  {
    id: "sg_asymmetric_rules",
    category: "smell",
    check: ({ trafficEdges, nodeById }) => {
      const results = [];
      trafficEdges.forEach((e) => {
        const ingress = e.data?.ingress || [];
        const egress  = (e.data?.egress  || []).filter((r) => !r._mirrored);
        const src = nodeById(e.source);
        const tgt = nodeById(e.target);
        if (!src || !tgt) return;
        if (ingress.length > 0 && egress.length === 0) {
          results.push({
            node: tgt,
            message: `${src.data.label} → ${tgt.data.label} has inbound rules but no outbound — ${src.data.label}'s SG will block return traffic`,
          });
        }
        if (egress.length > 0 && ingress.length === 0) {
          results.push({
            node: src,
            message: `${src.data.label} → ${tgt.data.label} has outbound rules but no inbound — ${tgt.data.label}'s SG will block incoming traffic`,
          });
        }
      });
      return results;
    },
  },

    // ─── IAM ───────────────────────────────────────────────────────────────────

  {
    id: "ec2_no_iam_role",
    category: "security",
    check: ({ ec2WithoutRole }) =>
      ec2WithoutRole().map((n) => ({
        node: n,
        message: `${n.data.label} has no IAM role — any AWS API calls from this instance will fail with AccessDenied at runtime`,
      })),
  },

  {
    id: "role_redundant_policies",
    category: "smell",
    check: ({ roles }) => {
      const results = [];
      const REDUNDANT_PAIRS = [
        ["AmazonS3ReadOnlyAccess",       "AmazonS3FullAccess"],
        ["AmazonDynamoDBReadOnlyAccess",  "AmazonDynamoDBFullAccess"],
        ["CloudWatchAgentServerPolicy",   "CloudWatchFullAccess"],
        ["CloudWatchLogsFullAccess",      "CloudWatchFullAccess"],
        ["AmazonMSKReadOnlyAccess",       "AmazonMSKFullAccess"],
      ];
      roles.forEach((role) => {
        REDUNDANT_PAIRS.forEach(([lesser, greater]) => {
          if (role.policies.includes(lesser) && role.policies.includes(greater)) {
            results.push({
              node: null,
              message: `Role "${role.name}" has both ${lesser} and ${greater} — ${greater} supersedes ${lesser}, remove the lesser policy`,
            });
          }
        });
      });
      return results;
    },
  },

  {
    id: "role_defined_unassigned",
    category: "smell",
    check: ({ unassignedRoles }) =>
      unassignedRoles.map((role) => ({
        node: null,
        message: `Role "${role.name}" is defined but not assigned to any node — will generate dead IAM resources in Terraform`,
      })),
  },

  // ─── ECS ───────────────────────────────────────────────────────────────────

  {
    id: "ecs_no_iam_role",
    category: "security",
    check: ({ byResourceType, roleById }) => {
      const ecs = byResourceType["ECS"] || [];
      return ecs
        .filter((n) => {
          const roleId = n.data?.config?.iam_role_id;
          return !roleId || !roleById(roleId);
        })
        .map((n) => ({
          node: n,
          message: `${n.data.label} has no IAM task role — AWS API calls from the container will fail with AccessDenied`,
        }));
    },
  },

  {
    id: "ecs_no_lb_target",
    category: "availability",
    check: ({ byResourceType, lbs, trafficNeighbors }) => {
      const ecs = byResourceType["ECS"] || [];
      return ecs
        .filter((n) => {
          const neighbors = trafficNeighbors(n.id);
          return !neighbors.some((nb) => nb?.data?.resourceType === "LoadBalancer");
        })
        .map((n) => ({
          node: n,
          message: `${n.data.label} has no Load Balancer — traffic cannot be distributed across tasks`,
        }));
    },
  },

  {
    id: "ecs_fargate_cost",
    category: "cost",
    check: ({ byResourceType }) => {
      const ecs = byResourceType["ECS"] || [];
      return ecs
        .filter((n) => n.data?.config?.launch_type === "FARGATE")
        .map((n) => ({
          node: n,
          message: `${n.data.label} uses Fargate — charged per vCPU/GB-hour while tasks are running (~$0.04/vCPU-hr + $0.004/GB-hr)`,
        }));
    },
  },

  {
    id: "ecs_desired_count_single",
    category: "availability",
    check: ({ byResourceType }) => {
      const ecs = byResourceType["ECS"] || [];
      return ecs
        .filter((n) => parseInt(n.data?.config?.desired_count, 10) === 1)
        .map((n) => ({
          node: n,
          message: `${n.data.label} desired count is 1 — a task failure causes full downtime; set to 2+ for availability`,
        }));
    },
  },

  {
    id: "ecs_in_public_subnet",
    category: "security",
    check: ({ byResourceType, publicSubnets, nodeById }) => {
      const ecs = byResourceType["ECS"] || [];
      return ecs
        .filter((n) => {
          const subnet = nodeById(n.data?.config?.subnetId);
          return publicSubnets.some((s) => s.id === subnet?.id);
        })
        .map((n) => ({
          node: n,
          message: `${n.data.label} is in a public subnet — place ECS tasks in private subnets and route traffic via a Load Balancer`,
        }));
    },
  },

  // ─── Lambda ────────────────────────────────────────────────────────────────

  {
    id: "lambda_no_iam_role",
    category: "security",
    check: ({ byResourceType, roleById }) => {
      const lambdas = byResourceType["Lambda"] || [];
      return lambdas
        .filter((n) => {
          const roleId = n.data?.config?.iam_role_id;
          return !roleId || !roleById(roleId);
        })
        .map((n) => ({
          node: n,
          message: `${n.data.label} has no execution role — Lambda cannot run without an IAM role; all invocations will fail`,
        }));
    },
  },

  {
    id: "lambda_high_timeout",
    category: "cost",
    check: ({ byResourceType }) => {
      const lambdas = byResourceType["Lambda"] || [];
      return lambdas
        .filter((n) => parseInt(n.data?.config?.timeout, 10) > 60)
        .map((n) => ({
          node: n,
          message: `${n.data.label} timeout is over 60s — long timeouts increase cost and indicate the function may be doing too much`,
        }));
    },
  },

  {
    id: "lambda_high_memory",
    category: "cost",
    check: ({ byResourceType }) => {
      const lambdas = byResourceType["Lambda"] || [];
      return lambdas
        .filter((n) => parseInt(n.data?.config?.memory_size, 10) >= 2048)
        .map((n) => ({
          node: n,
          message: `${n.data.label} memory is ${n.data.config.memory_size}MB — profile with Lambda Power Tuning before setting high memory`,
        }));
    },
  },

  {
    id: "lambda_vpc_cold_start",
    category: "availability",
    check: ({ byResourceType }) => {
      const lambdas = byResourceType["Lambda"] || [];
      return lambdas
        .filter((n) => n.data?.config?.vpc_enabled === "true")
        .map((n) => ({
          node: n,
          message: `${n.data.label} is VPC-attached — cold starts are significantly longer; only use VPC if accessing private RDS or ElastiCache`,
        }));
    },
  },

  {
    id: "lambda_cost",
    category: "cost",
    check: ({ byResourceType }) => {
      const lambdas = byResourceType["Lambda"] || [];
      return lambdas.map((n) => ({
        node: n,
        message: `${n.data.label} — first 1M requests/month free, then $0.20/1M requests + $0.0000166667/GB-second`,
      }));
    },
  },

  // ─── DynamoDB ──────────────────────────────────────────────────────────────

  {
    id: "dynamodb_no_pitr",
    category: "availability",
    check: ({ byResourceType }) => {
      const tables = byResourceType["DynamoDB"] || [];
      return tables
        .filter((n) => n.data?.config?.point_in_time_recovery !== "true")
        .map((n) => ({
          node: n,
          message: `${n.data.label} has Point-in-Time Recovery disabled — accidental deletes cannot be recovered without PITR`,
        }));
    },
  },

  {
    id: "dynamodb_no_sort_key",
    category: "smell",
    check: ({ byResourceType }) => {
      const tables = byResourceType["DynamoDB"] || [];
      return tables
        .filter((n) => !n.data?.config?.range_key?.trim())
        .map((n) => ({
          node: n,
          message: `${n.data.label} has no sort key — single-key tables limit query flexibility; consider adding a sort key for range queries`,
        }));
    },
  },

  {
    id: "dynamodb_provisioned_cost",
    category: "cost",
    check: ({ byResourceType }) => {
      const tables = byResourceType["DynamoDB"] || [];
      return tables
        .filter((n) => n.data?.config?.billing_mode === "PROVISIONED")
        .map((n) => ({
          node: n,
          message: `${n.data.label} uses PROVISIONED billing — you pay for capacity whether used or not; prefer PAY_PER_REQUEST for variable workloads`,
        }));
    },
  },

  {
    id: "dynamodb_cost",
    category: "cost",
    check: ({ byResourceType }) => {
      const tables = byResourceType["DynamoDB"] || [];
      return tables.map((n) => ({
        node: n,
        message: `${n.data.label} — on-demand: ~$1.25/million writes, $0.25/million reads + $0.25/GB-month storage`,
      }));
    },
  },

  // ─── SQS ───────────────────────────────────────────────────────────────────

  {
    id: "sqs_no_dlq",
    category: "availability",
    check: ({ byResourceType }) => {
      const queues = byResourceType["SQS"] || [];
      return queues
        .filter((n) => n.data?.config?.dlq_enabled !== "true")
        .map((n) => ({
          node: n,
          message: `${n.data.label} has no Dead Letter Queue — failed messages will be lost after max receive attempts`,
        }));
    },
  },

  {
    id: "sqs_fifo_name",
    category: "smell",
    check: ({ byResourceType }) => {
      const queues = byResourceType["SQS"] || [];
      return queues
        .filter((n) => {
          const name = n.data?.config?.queue_name || "";
          return n.data?.config?.fifo === "true" && !name.endsWith(".fifo");
        })
        .map((n) => ({
          node: n,
          message: `${n.data.label} is a FIFO queue but the name doesn't end in ".fifo" — AWS will reject it at apply time`,
        }));
    },
  },

  {
    id: "sqs_no_consumers",
    category: "connectivity",
    check: ({ byResourceType, trafficNeighbors }) => {
      const queues = byResourceType["SQS"] || [];
      return queues
        .filter((n) => {
          const neighbors = trafficNeighbors(n.id);
          return !neighbors.some((nb) =>
            ["EC2", "ECS", "Lambda"].includes(nb?.data?.resourceType)
          );
        })
        .map((n) => ({
          node: n,
          message: `${n.data.label} has no consumers (EC2/ECS/Lambda) — messages will accumulate with no processing`,
        }));
    },
  },

  {
    id: "sqs_cost",
    category: "cost",
    check: ({ byResourceType }) => {
      const queues = byResourceType["SQS"] || [];
      return queues.map((n) => ({
        node: n,
        message: `${n.data.label} — first 1M requests/month free; standard ~$0.40/million, FIFO ~$0.50/million thereafter`,
      }));
    },
  },

  // ─── S3 ────────────────────────────────────────────────────────────────────

  {
    id: "s3_public_acl_no_block",
    category: "security",
    check: ({ byResourceType }) => {
      const buckets = byResourceType["S3"] || [];
      return buckets
        .filter((b) => {
          const acl = b.data?.config?.acl || "private";
          const blocked = b.data?.config?.block_public_access;
          return acl !== "private" && acl !== "authenticated-read" && blocked !== "true";
        })
        .map((b) => ({
          node: b,
          message: `${b.data.label} has a public ACL ("${b.data?.config?.acl}") and Block Public Access is disabled — bucket contents may be publicly accessible`,
        }));
    },
  },

  {
    id: "s3_block_public_access_off",
    category: "security",
    check: ({ byResourceType }) => {
      const buckets = byResourceType["S3"] || [];
      return buckets
        .filter((b) => b.data?.config?.block_public_access !== "true")
        .map((b) => ({
          node: b,
          message: `${b.data.label} has Block Public Access disabled — AWS best practice is to enable this on all buckets unless explicitly serving public content`,
        }));
    },
  },

  {
    id: "s3_no_encryption",
    category: "security",
    check: ({ byResourceType }) => {
      const buckets = byResourceType["S3"] || [];
      return buckets
        .filter((b) => !b.data?.config?.encryption || b.data.config.encryption === "None")
        .map((b) => ({
          node: b,
          message: `${b.data.label} has no server-side encryption — enable SSE-S3 (free) or SSE-KMS for data at rest protection`,
        }));
    },
  },

  {
    id: "s3_no_versioning",
    category: "availability",
    check: ({ byResourceType }) => {
      const buckets = byResourceType["S3"] || [];
      return buckets
        .filter((b) => b.data?.config?.versioning !== "Enabled")
        .map((b) => ({
          node: b,
          message: `${b.data.label} has versioning disabled — accidental deletes or overwrites are unrecoverable without versioning`,
        }));
    },
  },

  {
    id: "s3_force_destroy_enabled",
    category: "smell",
    check: ({ byResourceType }) => {
      const buckets = byResourceType["S3"] || [];
      return buckets
        .filter((b) => b.data?.config?.force_destroy === "true")
        .map((b) => ({
          node: b,
          message: `${b.data.label} has force_destroy = true — all objects will be permanently deleted on terraform destroy with no recovery`,
        }));
    },
  },

  {
    id: "s3_public_read_write",
    category: "security",
    check: ({ byResourceType }) => {
      const buckets = byResourceType["S3"] || [];
      return buckets
        .filter((b) => b.data?.config?.acl === "public-read-write")
        .map((b) => ({
          node: b,
          message: `${b.data.label} ACL is public-read-write — anyone on the internet can write objects to this bucket`,
        }));
    },
  },

  {
    id: "s3_cost_note",
    category: "cost",
    check: ({ byResourceType }) => {
      const buckets = byResourceType["S3"] || [];
      return buckets.map((b) => ({
        node: b,
        message: `${b.data.label} — charged per GB stored, per 1,000 requests, and per GB data transfer out. Versioning multiplies storage cost.`,
      }));
    },
  },

];

export const CATEGORY_LABELS = {
  deprecated:    "Deprecated",
  connectivity:  "Connectivity",
  security:      "Security",
  availability:  "Availability",
  cost:          "Cost",
  smell:         "Architecture",
};