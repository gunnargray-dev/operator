import appIcon from "@/assets/pplx-icon.png"
import { StepFormLayout, ContinueButton } from "./primitives"

interface WelcomeStepProps {
  onContinue: () => void
  /** Whether this is an existing user updating settings */
  isExistingUser?: boolean
}

/**
 * WelcomeStep - Initial welcome screen for onboarding
 *
 * Shows different messaging for new vs existing users:
 * - New users: Welcome to Perplexity
 * - Existing users: Update your billing settings
 */
export function WelcomeStep({
  onContinue,
  isExistingUser = false
}: WelcomeStepProps) {
  return (
    <StepFormLayout
      iconElement={
        <div className="flex items-center justify-center">
          <img src={appIcon} alt="Perplexity" className="size-16 rounded-2xl" />
        </div>
      }
      title={isExistingUser ? 'Update Settings' : 'Welcome to Perplexity'}
      description={
        isExistingUser
          ? 'Update billing or change your setup.'
          : 'Run tasks in parallel, track progress visually, and let AI handle the work while you focus on what matters.'
      }
      actions={
        <ContinueButton onClick={onContinue} className="w-full">
          {isExistingUser ? 'Continue' : 'Get Started'}
        </ContinueButton>
      }
    />
  )
}
