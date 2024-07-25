Feature: progress-bars

    Scenario: select nyan cat progress bar
        Given the user has logged in with username "admin" and password "admin"
        And the user has navigated to the account menu
        Then the user selects the progress bar extension "Nyan Cat progress bar"
