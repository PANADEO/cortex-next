export { GovernancePanel } from "./components/governance-panel"
export { ProjectsPanel } from "./components/projects-panel"
export {
  useCreateProject,
  useDeleteProject,
  useGovernanceConfig,
  useUpdateGovernance,
  useUpdateProject,
} from "./hooks/use-governance"
export { configApi, configQueryKeys, type GovernanceUpdate, type ProjectInput } from "./queries"
