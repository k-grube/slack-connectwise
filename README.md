# slack-connectwise

A nodejs based slash command for Slack.

## Usage

> /cw [ link | ticket | config ]
> 
>   [l]ink [ <ticketNbr> | <summary> ]
>       link [<ticketNbr>]          - post a link to the ticket $ticketNbr
>       link [<summary>]            - post the first 5 results of a search for $summary
>    
>   [t]icket [[c]reate | [f]ind | [s]tatus ]  
>       ticket create [<summary=initial summary> <company=companyId> <board=boardName>]
>                                   - create a ticket with $summary, for $companyId, on $boardName
>       ticket find [<summary>]     - post the first 5 results of a saerch for $summary
>       ticket status [<ticketid> <status>] 
>                                   - change the status of $ticketId to $status
>  
>   [c]onfig [[f]ind 
>       config find [<configName>]  - post the first 5 results of a search for $configName
>       config find [<configId>]    - post a link to the config $configId