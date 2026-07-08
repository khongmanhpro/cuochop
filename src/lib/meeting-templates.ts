export type MeetingTemplateId =
  | "default"
  | "sales"
  | "planning"
  | "feedback"
  | "standup"
  | "oneonone"
  | "retro"
  | "brainstorm"
  | "kickoff"
  | "interview";

export type MeetingTemplate = {
  id: MeetingTemplateId;
  label: string;
  description: string;
  promptSuffix: string;
  icon: string;
};

export const MEETING_TEMPLATES: MeetingTemplate[] = [
  {
    id: "default",
    label: "General Meeting",
    description: "Meeting thường — tổng hợp decisions, actions, blockers",
    icon: "📋",
    promptSuffix: "",
  },
  {
    id: "sales",
    label: "Sales Call",
    description: "Nhu cầu khách hàng, objections, next steps, deal stage",
    icon: "💰",
    promptSuffix: `

Focus đặc biệt cho Sales Call:
- Phát hiện nhu cầu (pain points) của khách hàng.
- Ghi nhận objections hoặc lo ngại khách hàng nêu.
- Tóm tắt sản phẩm/giải pháp đã trình bày.
- Next steps cụ thể: follow-up, demo, gửi báo giá.
- Ghi chú mức độ quan tâm của khách hàng (nếu có tín hiệu).
- Deal stage: prospect, qualified, proposal, negotiation, closed-won, closed-lost.
- Budget/timeline khách hàng提到 nếu có.`,
  },
  {
    id: "planning",
    label: "Internal Planning",
    description: "Mục tiêu, timeline, resources, phân công, dependencies",
    icon: "🗺️",
    promptSuffix: `

Focus đặc biệt cho Internal Planning:
- Mục tiêu và key results (OKR) nếu có.
- Timeline/milestone được đề cập.
- Resource allocation: ai làm gì, bao nhiêu người.
- Dependencies giữa các task.
- Risks/blockers liên quan đến plan.
- Decision về scope, priority, trade-offs.
- Budget allocation nếu提到.`,
  },
  {
    id: "feedback",
    label: "Client Feedback",
    description: "Feedback, pain points, feature requests, satisfaction",
    icon: "💬",
    promptSuffix: `

Focus đặc biệt cho Client Feedback:
- Feedback tích cực và tiêu cực của khách hàng.
- Pain points cụ thể khách hàng gặp phải.
- Feature requests hoặc yêu cầu cải thiện.
- Mức độ hài lòng chung (nếu có tín hiệu).
- Action items để address feedback.
- Timeline khách hàng kỳ vọng cho changes.
- NPS/CS score nếu提到.`,
  },
  {
    id: "standup",
    label: "Daily Standup",
    description: "Hôm qua làm gì, hôm nay làm gì, blockers",
    icon: "🏃",
    promptSuffix: `

Focus đặc biệt cho Daily Standup:
- Tóm tắt theo từng người: Yesterday, Today, Blockers.
- Blocker cần escalate ngay.
- Dependencies giữa các thành viên.
- Task nào đang stuck.
- Không cần executive summary dài.
- Format gọn, dễ scan nhanh.
- Action items chỉ ghi blocker cần gỡ.`,
  },
  {
    id: "oneonone",
    label: "1-on-1 Meeting",
    description: "1:1 cá nhân — career, feedback, support, goals",
    icon: "👥",
    promptSuffix: `

Focus đặc biệt cho 1-on-1:
- Cảm nhận/mood của người được talk (nếu có tín hiệu).
- Career goals hoặc aspirations提到.
- Feedback hai chiều (manager → report, report → manager).
- Support cần từ manager hoặc công ty.
- Personal development items.
- Blockers cá nhân (không chỉ công việc).
- Follow-up cho lần 1:1 trước nếu提到.
- Không cần bảng action items phức tạp, ưu tiên ghi chú cá nhân.`,
  },
  {
    id: "retro",
    label: "Retrospective",
    description: "What went well, what didn't, action items cải thiện",
    icon: "🔄",
    promptSuffix: `

Focus đặc biệt cho Retrospective:
- Went well (điều tốt).
- Didn't go well (điều cần cải thiện).
- Action items cải thiện cụ thể.
- Root cause分析 nếu讨论.
- Experiment mới muốn thử.
- Team morale/collaboration signals.
- Format: nhóm theo category (went well / didn't / actions).`,
  },
  {
    id: "brainstorm",
    label: "Brainstorm / Ideation",
    description: "Ý tưởng, vote, feasibility, next steps",
    icon: "💡",
    promptSuffix: `

Focus đặc biệt cho Brainstorm/Ideation:
- Liệt kê tất cả ý tưởng提到 (không filter).
- Phân loại ý tưởng: quick win, big bet, long-term.
- Vote/priority signals nếu有讨论.
- Feasibility讨论 (tech, time, cost).
- Next steps: prototype, research, decide.
- Không cần executive summary dài.
- Ưu tiên quantity > quality trong brainstorm notes.`,
  },
  {
    id: "kickoff",
    label: "Project Kickoff",
    description: "Scope, timeline, team roles, success metrics, risks",
    icon: "🚀",
    promptSuffix: `

Focus đặc biệt cho Project Kickoff:
- Project scope và objectives rõ ràng.
- Timeline/milestone từ đầu.
- Team roles và responsibilities.
- Success metrics/KPIs定义.
- Known risks và mitigation.
- Communication plan (tools, cadence).
- Dependencies và constraints.
- Decision log quan trọng cho project start.`,
  },
  {
    id: "interview",
    label: "Interview / Hiring",
    description: "Candidate evaluation, strengths, concerns, next steps",
    icon: "🎯",
    promptSuffix: `

Focus đặc biệt cho Interview/Hiring:
- Candidate strengths và weaknesses.
- Technical skills đánh giá.
- Cultural fit signals.
- Concerns hoặc red flags.
- Salary/compensation讨论 nếu có.
- Next steps: offer, reject, next round.
- Interviewer's recommendation.
- Không cần action items phức tạp, focus evaluation.`,
  },
];

export function getMeetingTemplate(id: string): MeetingTemplate {
  return MEETING_TEMPLATES.find((t) => t.id === id) ?? MEETING_TEMPLATES[0];
}
