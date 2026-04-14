// server/services/executionPlanner.ts

export async function generateExecutionPlan(services: string[]): Promise<string> {
  if (!Array.isArray(services) || services.length === 0) {
    return "No services detected. Please specify which strategies to execute.";
  }

  const uniqueServices = Array.from(
    new Set(
      services
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter((s) => s.length > 0)
    )
  );

  if (uniqueServices.length === 0) {
    return "No valid services detected. Please specify valid strategies.";
  }

  return uniqueServices
    .map((service, idx) => `${idx + 1}. Execute ${service} strategy`)
    .join("\n");
}
