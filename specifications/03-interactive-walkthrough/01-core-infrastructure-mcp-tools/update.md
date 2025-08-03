# Update to MCP tool walkthroughs

There are a couple of problems that we need to address:

1. User progress for a given walkthrough should be tracked on the backend. currently, the `get_next_step` tool requires a `current_step_id`; but actually wen a user starts the walkthrough with `start_walkthrough` (or resets their progress) we should set their current step for the given walkthrough to the first step, and return it. 
2. Any time a user calls `get_next_step` their current step in the database should be set to the next one, and it should be returned. 
3. we should make sure to design this in a way that supports the way that walkthrough steps can be re-ordered, or added, or removed in the UI
4. we should make sure that this is supported in the event / progress tracking. in addition to existing progress tracking, we want to track the following:
    - each time a user starts a walkthrough - which walkthrough, which server it was started through, and the time
    - each time a user lists walkthroughs
    - each time get_next_step is called; what step they were on / what's next, and the timestamp and the server it was through
    - each time a user resets their progress
These will allow us to formulate progress analytics and sankey diagrams. make sure that this is well-integrated into the existing progress system; come up with a list of additions and mmodifications to faciliate this.
5. think about removing `list_walkthroughs` all together, and consider using a single `start_walkthrough` tool that when called without parameters, (a) if there is only one walkthrough starts it automatically otherwise (b) if there are multiple then it lists them and tells the model to call it again with the title of the walkthrough to start; and (c) if the model provides an invalid walkthrough name, it lists the walkthroughs again and tells it that it was an invalid walkthrough name. 