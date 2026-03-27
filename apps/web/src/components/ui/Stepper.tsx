interface StepperProps {
  steps: string[];
  activeStep: number;
}

export function Stepper({ steps, activeStep }: StepperProps) {
  return (
    <div className="stepper" data-testid="stepper">
      {steps.map((label, index) => {
        const isCompleted = index < activeStep;
        const isActive = index === activeStep;

        let stepClass = "stepper__step";
        if (isCompleted) stepClass += " stepper__step--completed";
        if (isActive) stepClass += " stepper__step--active";

        return (
          <div key={index} className={stepClass} data-testid={`step-${index}`}>
            <div className="stepper__indicator">
              <span className="stepper__number">
                {isCompleted ? "\u2713" : index + 1}
              </span>
            </div>
            <span className="stepper__label">{label}</span>
            {index < steps.length - 1 && (
              <div
                className={`stepper__connector ${isCompleted ? "stepper__connector--completed" : ""}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
