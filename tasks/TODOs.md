# TODOs

This file contains lists of tasks inserted by the user to be implemented by the agent.

## From TODOs to backlog

Agent must pick each of these tasks and create a backlog.md entry for each.

## Task List

- dashboard is too bloated. separete concerns. member and admin classes should be on its own files.
- status alerts should be replaced by a toast system, look at references to see how we already did it.
- there should be no interaction with user using alert, input, confirm, etc. use proper modal components. check refences on how we do it.
- I see lots of modules having functions mixed with exported classes. I want you to take a good look on the code, and refactor the modules, so files meant to export classes are just that. use good OOP and clean code best practices.
- No dashboard button on the header if user is not logged in. if user is logged in, show the dashboard button and hide the login button. Instead of dashboard, pick a name that makes more sense to you, but it has to be something different than "dashboard". maybe "Minha Conta", "Área do Usuário", "Central de Eventos", etc. pick something that makes more sense in the context of the project.
- this hero section on dashboard simply makes no sense. remove it.
- I am not seeing the sense of this Pill components. just remove it from project.
- just remove the publish page from project. when a user want to publish a new event, a modal should show up with the form to publish the event (check modal component references). the same modal can be used to edit an event, just pre-fill the form with the event data when editing.
- b