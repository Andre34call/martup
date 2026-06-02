---
Task ID: 5
Agent: manager-role-agent
Task: Enhance Manager role and admin UI for division oversight

Work Log:
- Read worklog.md and all relevant files to understand current state
- Updated admin users screen with legal/hr role filters, Manager visual indicators, and Promote to Manager button
- Updated admin dashboard with Division Overview section for Manager+ roles
- Updated admin store with divisionOverview state and fetchDivisionOverview action
- Updated store types with divisionOverview and fetchDivisionOverview in AdminSlice
- Enhanced admin stats API with divisionWorkItemCounts using workItem.groupBy
- Added divisionWorkItemCounts to AdminStats type
- Lint passes ✅

Stage Summary:
- Admin Users: legal/hr filters, Manager violet border + Crown icon, Super Admin purple border + Sparkles icon, prominent gradient "Promote to Manager" button
- Admin Dashboard: Division Overview section for Manager+ roles with divisions, member counts, work item counts, quick navigation
- Admin Store: divisionOverview state + fetchDivisionOverview action using stats API divisionWorkItemCounts
- Stats API: Efficient per-division work item counts via groupBy
- Zero breaking changes — lint passes ✅
