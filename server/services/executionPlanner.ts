// server/services/executionPlanner.ts

/**
 * generateExecutionPlan
 * Generates a structured execution plan for one or multiple services.
 *
 * @param services - Array of service names to generate steps for.
 * @returns string - A numbered execution plan for each service.
 */
export async function generateExecutionPlan(services: string[]): Promise<string> {
  if (!Array.isArray(services) || services.length === 0) {
    return "No services detected. Please specify which strategies to execute.";
  }

  // Normalize service names to avoid duplicate steps
  const uniqueServices = Array.from(new Set(services.map((s) => s.trim()).filter(Boolean)));

  // Generate execution steps for each service
  const planSteps: string[] = [];

  uniqueServices.forEach((service, idx) => {
    planSteps.push(`${idx + 1}. Execute ${service} strategy`);
  });

  return planSteps.join("\n");
}
