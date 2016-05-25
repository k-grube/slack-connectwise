# slack-connectwise

A basic node.js based slash command for Slack for ConnectWise. 

## Usage

>​/cw​ [ $ticketNbr​ ] | [ link​ | ticket​ ]
>
>   [ -l | --link ] [ ​$ticketNbr | $summary​ ]
>      --link -n [ $ticketNbr ] - post a link to the ticket $ticketNbr
>      --link -- [ $summary ]   - post the first 3 results of a search for $summary
>
>   [ -t | --ticket ] [ ​find​ ]  
>      --ticket find -- [ ​$summary​ ]  - post the first 3 results of a search for $summary

## Installation

Clone to Heroku, or your own thing. 
Set environment variables.

>   COMPANY_ID=YourCompany
>   COMPANY_URL=cw.yourcompany.com
>
>   PUBLIC_KEY=abcdef12345
>       CW API user public key
>
>   PRIVATE_KEY=abcdef12345
>       CW API user private key
>
>   SLACK_SLASH_TOKEN=abcdef12345
>       Token for the slash command from Slack
>
>   SLACK_TZ=America/Los_Angeles
>       See moment.js timezone formats, used to convert dates from UTC

Note: Doesn't support cloud-hosted ConnectWise, yet.

Start with `node ./bin/www`

Point the Slash command to `<boturl>/api/slack`.
 