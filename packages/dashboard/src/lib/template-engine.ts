import type { Walkthrough, WalkthroughStep } from 'database'
import nunjucks from 'nunjucks'

// Configure Nunjucks without autoescape since we're templating markdown, not HTML
const env = new nunjucks.Environment(null, {
    autoescape: false,
    throwOnUndefined: false
})

const WALKTHROUGH_TEMPLATE = `
# Walkthrough: {{ walkthroughTitle }}

## Step {{ displayOrder }}: {{ stepTitle }}

{% if introductionForAgent and introductionForAgent.trim() %}
<step_information>
{{ introductionForAgent }}
</step_information>
{% endif %}

{% if contextForAgent and contextForAgent.trim() %}
<background_information_context>
{{ contextForAgent }}
</background_information_context>
{% endif %}

{% if operationsForAgent and operationsForAgent.trim() %}
<operations_to_perform>
{{ operationsForAgent }}
</operations_to_perform>
{% endif %}

{% if contentForUser and contentForUser.trim() %}
<step_content>
{{ contentForUser }}
</step_content>
{% endif %}

---

*This is step {{ displayOrder }} in the "{{ walkthroughTitle }}" walkthrough. Use the step navigation tools to guide the user through the process.*
`.trim()

/**
 * Renders a walkthrough step using the Nunjucks template engine
 * Combines walkthrough and step data into a structured template for AI agent consumption
 */
export function renderWalkthroughStep(walkthrough: Walkthrough, step: WalkthroughStep): string {
    const contentFields = step.contentFields as any

    const templateData = {
        walkthroughTitle: walkthrough.title,
        stepTitle: step.title,
        displayOrder: step.displayOrder,
        introductionForAgent: contentFields?.introductionForAgent || '',
        contextForAgent: contentFields?.contextForAgent || '',
        contentForUser: contentFields?.contentForUser || '',
        operationsForAgent: contentFields?.operationsForAgent || ''
    }

    return env.renderString(WALKTHROUGH_TEMPLATE, templateData)
}
