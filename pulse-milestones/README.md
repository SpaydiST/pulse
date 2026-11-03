# Pulse Milestones

Optional Paper plugin for awarding configured milestones from Pulse player activity data.

1. Install `pulse-1.0.0.jar` and `pulse-milestones-1.0.0.jar` in `plugins/`.
2. Configure milestones in `plugins/PulseMilestones/config.yml`.

On first start, existing `milestones` settings in `plugins/Pulse/config.yml` are copied into the module config. The module then reads only its own configuration. It checks online players every minute and runs configured console commands when a milestone is reached.
