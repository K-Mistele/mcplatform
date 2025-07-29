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
*This is step {{ displayOrder }} in the "{{ walkthroughTitle }}" walkthrough. 
Use the step navigation tools to guide the user through the process.*


{% if introductionForAgent and introductionForAgent.trim() %}
The below information between <step_information_and_objectives> and </step_information_and_objectives> contains information about the step including learning objectives and definitions of done.
When the step's objectives have been met, you should ask the user if they are ready to move on to the next step.
If so, you should use the step navigation tools to move to the next step.

<step_information_and_objectives>
{{ introductionForAgent }}
</step_information_and_objectives>
{% endif %}

{% if contextForAgent and contextForAgent.trim() %}
The following information between <background_information_context> and </background_information_context> contains background information about the step.
This information is for the agent (you) to reference when you are performing the step or helping the user through it. 

<background_information_context>
{{ contextForAgent }}
</background_information_context>
{% endif %}

{% if operationsForAgent and operationsForAgent.trim() %}
The following information between <operations_to_perform> and </operations_to_perform> contains the operations to perform for the step.
These are the actions the agent (you) should take to help the user through the step.
When the user has completed the step, you should ask them to confirm the step is complete.
If so, you should use the step navigation tools to move to the next step.

<operations_to_perform>
{{ operationsForAgent }}
</operations_to_perform>
{% endif %}

{% if contentForUser and contentForUser.trim() %}
The following information between <step_content> and </step_content> contains the content for the user to read.
This is the information that the user will see when they are performing the step.
You should repeat this information to the user VERBATIM as it is written before taking other actions such as the operations, asking questions, etc.

<step_content>
{{ contentForUser }}
</step_content>
{% endif %}

---

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
