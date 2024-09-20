import { SocksProxyAgent } from "socks-proxy-agent";
import { API, Logger, ProxyScraper } from "./api.js";
import { promises as fs } from 'fs';
import chalk from "chalk";
import readline from 'readline'

const waitForSeconds = (seconds) => {
    return new Promise(resolve => {
        setTimeout(resolve, seconds * 1000); // Convert seconds to milliseconds
    });
};
/**
 * Generates a random integer between min (inclusive) and max (inclusive).
 * @param {number} min - The minimum value (inclusive).
 * @param {number} max - The maximum value (inclusive).
 * @returns {number} - A random integer between min and max.
 */
const getRandomBetween = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

const askQuestion = (query) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
};

let cooldownTime = 0 // in seconds
let api // api client
let logger = new Logger()

// const questionProxy = await askQuestion('Do you want to use proxy? (y/n): ');

const main = async () => {
    
    let useProxy = false;
    let proxy = null
    let liveProxies = null

    let accountCounter = 1
    let accountName = `#Account`

    if (useProxy) {
        proxy = new ProxyScraper()
        liveProxies = await proxy.getLiveProxy()
    }

    const processAccount = async () => {

        // Load all data mimick app flow
        /**
         * 1. create session
         * 2. get boost
         * 3. get levels
         * 4. get task
         * 5. get profile self
         * 6. get daily reward
         * 7. get tournaments
         * 
         * Action
         * 1. claim daily login
         * 2. submit task
         * 3. taptap
         * 4. buy boost and tap tap again
         * 5. Investing (coming soon waiting update from developer game), this code 19 September 2024
         */

        await api.createSession()
        let boosts = await api.getProfileBoosts()
        const {levels} = await api.getLevels()
        const tasks = await api.getTaskList()
        let myProfile = await api.getProfileSelf()
        const dailyreward = await api.getDailyRewards()
        const wallet = await api.checkWallet()
        const levelName = levels.filter((level) => level.level === myProfile.level)[0]?.name ?? '-'
        logger.info(chalk.blue(`=========[PROFILE]=========`))
        logger.info(`ID                     : ` +chalk.blue(myProfile.user_id))
        logger.info(`Name                   : ` +chalk.blue(myProfile.name))
        logger.info(`Level                  : ` + chalk.blue(myProfile.level + ` | ${levelName}`))
        logger.info(`Energy Max Value       : ` + chalk.blue(myProfile.energy_max_value))
        logger.info(`Energy Rate            : `+ chalk.blue(myProfile.energy_rate))
        logger.info(`Energy Current Value   : `+ chalk.blue(myProfile.energy_current_value))
        logger.info(`Coins Multiplier       : `+ chalk.blue(myProfile.coins_multiplier))
        logger.info(`Current Coins Balance  : `+ chalk.blue(myProfile.coins_balance))
        logger.info(`Connected Wallet       : ${wallet ? chalk.green(wallet.address) : chalk.red('No') }`)

        // await api.addTONWallet()

        // start botting
        dailyreward.collectable ? await api.submitDailyReward() : logger.warn(`Already claim daily reward`)
        for (const task of tasks.items) {
            if (task.completed_at) {
                logger.warn(`Task ${task.id}: Already claimed`)
            } else {
                await api.submitTask(task.id)
            }
            await waitForSeconds(1)
        }
        let energy_current_value = parseInt(myProfile.energy_current_value)
        let totalClaimTap = 0
        while (energy_current_value > 144) {
            const random = getRandomBetween(80, 144)
            const tapResult = await api.actionTapTap(random)
            energy_current_value = tapResult.energy_current_value
            totalClaimTap = totalClaimTap + tapResult.added_coins
            await waitForSeconds(1)
        }
        console.log(``)
        logger.success(`Finish taptap get rewards ${totalClaimTap} coins`)
        myProfile = await api.getProfileSelf()
        await waitForSeconds(5)

        // upgrade till maxxxx
        let coins_balance = myProfile.coins_balance
        let energy_limit = boosts["energy_limit"]
        let multitap = boosts["multitap"]
        let refill_energy = boosts["refill_energy"]


        while (coins_balance > 400000) {
            logger.warn("=== UPGRADE SKILLS ===");
            try {
                // Compare prices and buy the cheaper option first
                if (multitap.price < energy_limit.price && coins_balance > multitap.price) {
                    const response = await api.submitBoost("multitap");
                    multitap = response["multitap"];
                } else if (coins_balance > energy_limit.price) {
                    const response = await api.submitBoost("energy_limit");
                    energy_limit = response["energy_limit"];
                } else {
                    logger.info(`Exit from upgrading`);
                    break;
                }
            } catch (err) {
                logger.info(`Exit from upgrading`);
            } finally {
                myProfile = await api.getProfileSelf();
                coins_balance = myProfile.coins_balance;
                boosts = await api.getProfileBoosts();
                await waitForSeconds(5);
            }
        }

        if (refill_energy.current_cooldown === 0) {
            logger.info(`Starting tap tap again with free booster`)
            try {
                if (refill_energy.current_available > 0) {
                    // Refilling energy
                    await api.submitBoost("refill_energy");
                    myProfile = await api.getProfileSelf();
                    await waitForSeconds(5)
                    let energyCurrentValue = parseInt(myProfile.energy_current_value)

                    // Use a more readable variable name
                    let totalClaimTap2 = 0
                    while (energyCurrentValue > 255) {
                        const random = getRandomBetween(100, 255)
                        const tapResult = await api.actionTapTap(random);
                        energyCurrentValue = tapResult.energy_current_value
                        totalClaimTap2 = totalClaimTap2 + tapResult.added_coins
                        await waitForSeconds(1)
                    }
                    console.log(``)
                    logger.success(`Finish taptap get rewards ${totalClaimTap2} coins`)
                    // Fetch updated profile information
                    myProfile = await api.getProfileSelf();
                    boosts = await api.getProfileBoosts()
                    await waitForSeconds(5)
                }
            } catch (error) {
                console.log(error)
                logger.error('An error occurred during the energy refill process:', error);
            }
        } else {
            logger.warn(`Refill energy sedang cooldown ${refill_energy.current_cooldown} seconds!!`)
        }

        // await processPlayTrading()

        logger.success(`[${accountName} ${accountCounter}] Done, total balances: ${myProfile.coins_balance}`)
        accountCounter++
        cooldownTime = Math.floor(myProfile.energy_max_value/myProfile.energy_rate)
        await waitForSeconds(5)
    }

    try {
        const readInitDataFile = await fs.readFile('initData.txt', 'utf-8');
        const initData = readInitDataFile.split('\n')

        for (const query of initData) {
            let success = false;

            while (!success) { // Keep trying until processAccount succeeds
                try {
                    logger.info(chalk.blue(`============[START [${accountName} ${accountCounter}]]============`))
                    if (useProxy) {
                        const randomIndexProxy = Math.floor(Math.random() * liveProxies.length);
                        const agent = new SocksProxyAgent(liveProxies[randomIndexProxy]);
                        api = new API(query, agent)
                        logger.success(`with Proxy ${liveProxies[randomIndexProxy]}`)
                    } else {
                        api = new API(query)
                    }
                    await processAccount(); // Attempt to process account
                    success = true; // Mark success if no error occurs
                } catch (error) {
                    logger.error("Cannot process account, timeout! Switching proxy...");
                }
            }
        }

        await processAllAccountTrading() // Simultanously processing trading for all accounts, using no proxy for faster

        let totalBalancesAllAccount = 0
        for (const query of initData) {
            try {
                api = new API(query)
                await api.createSession()
                const getbalance = await api.getProfileSelf()
                totalBalancesAllAccount = totalBalancesAllAccount + getbalance.coins_balance
                logger.info(`[${getbalance.user_id}][${getbalance.name}][BALANCE]:    ${formatThousands(getbalance.coins_balance)}`)
            } catch {
                logger.error(`error getting balance`)
            }
        }

        logger.info(`Finish all process..`)
        logger.success(`[TOTAL BALANCES]: ${chalk.white(formatThousands(totalBalancesAllAccount))} coins || ${chalk.yellow(initData.length)} account`)
    } catch (error) {
        console.log("Error", error)
    }
}

function formatThousands(number) {
    const parts = number.toString().split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
}

const processPlayTrading = async () => {
    let tournaments = await api.getTradingTournaments()
    let myProfile = await api.getProfileSelf()
    const findAbleJoin = getJoinableTournaments(myProfile, tournaments.items)
    if (!findAbleJoin.length) {
        logger.warn('[GAME] No Tournament available');
        return;
    }
    if (myProfile.coins_balance < 10000) {
        logger.warn(`[GAME] Balance coin less than bet needed`)
        return;
    }
    for (const tournament of findAbleJoin) {
        const { id, title, status, max_rounds, round_interval, used_currency_id, user_played_rounds } = tournament
        logger.info(chalk.blue(`=========[TOURNAMENT]=========`))
        logger.info(`ID                 : `+ chalk.blue(id))
        logger.info(`Title              : `+ chalk.blue(title))
        logger.info(`Status             : `+ chalk.blue(status))
        logger.info(`Max Rounds         : `+ chalk.blue(max_rounds))
        logger.info(`Round Interval     : `+ chalk.blue(round_interval))
        logger.info(`Used Currency      : `+ chalk.blue(used_currency_id))
        logger.info(`User Played Rounds : `+ chalk.blue(user_played_rounds))
        let totalPlayed = user_played_rounds
        let betAmount = Math.floor(Math.round(myProfile.coins_balance / 1000))-1
        while (totalPlayed < max_rounds) {
            logger.info(`[GAME] Join tournament ${title}`)
            const isJoin = await api.joinTournament(id)
            if(!isJoin) break
            logger.info(`[GAME] Playing round ${totalPlayed}`)
            try {
                await waitForSeconds(round_interval)
                const openposition = await api.openTradingPosition(id, used_currency_id, betAmount.toString())
                if (openposition.translation_key === "") {
                    betAmount--
                } else {
                    if (openposition.translation_key === "flutter.amount_less_than_minimum" || openposition.translation_key === "flutter.open_amount_less_than_zero") {
                        logger.error(`[GAME] Balance less than minimum, exit tournament`)
                        break;
                    }
                    await waitForSeconds(round_interval * 4)
                    const closeposition = await api.closeTradingPosition(openposition.id)
                    await waitForSeconds(round_interval+1)
                    await api.getPositionLeaderboardTrading(id)
                }

            } catch (err) {
                betAmount--
            } finally {
                tournaments = await api.getTradingTournaments()
                myProfile = await api.getProfileSelf()
                totalPlayed = tournaments.items.filter((tournament) => tournament.id === id)[0].user_played_rounds
                logger.success(`[BALANCE] ${myProfile.coins_balance}`)
                if (myProfile.coins_balance < 10000) {
                    logger.warn(`[GAME] Balance coin less than minimum`)
                    break;
                }
            }
        }
        logger.success(`[GAME] Reach maximum round at tournament ${title}`)
    }
    logger.success(`Finish all tournaments`)
}

const processAllAccountTrading = () => {
    return new Promise( async (resolve, reject) => {
        const readInitDataFile = await fs.readFile('initData.txt', 'utf-8');
        const initData = readInitDataFile.split('\n')
        const tradingStart = initData.map(async (query) => {
            const apiTrading = new API(query)
            await apiTrading.createSession()
            let tournaments = await apiTrading.getTradingTournaments()
            let myProfile = await apiTrading.getProfileSelf()
            const findAbleJoin = getJoinableTournaments(myProfile, tournaments.items)
            if (!findAbleJoin.length) {
                logger.warn(`[${chalk.blue(myProfile.user_id)}] [GAME] No Tournament available`);
                return;
            }
            if (myProfile.coins_balance < 10000) {
                logger.warn(`[${chalk.blue(myProfile.user_id)}][GAME] Balance coin less than bet needed`)
                return;
            }
            for (const tournament of findAbleJoin) {
                const { id, title, status, max_rounds, round_interval, used_currency_id, user_played_rounds } = tournament
                logger.info(chalk.blue(`=========[TOURNAMENT]=========`))
                logger.info(`[${chalk.blue(myProfile.user_id)}]ID                 : ` + chalk.blue(id))
                logger.info(`[${chalk.blue(myProfile.user_id)}]Title              : ` + chalk.blue(title))
                logger.info(`[${chalk.blue(myProfile.user_id)}]Status             : ` + chalk.blue(status))
                logger.info(`[${chalk.blue(myProfile.user_id)}]Max Rounds         : ` + chalk.blue(max_rounds))
                logger.info(`[${chalk.blue(myProfile.user_id)}]Round Interval     : ` + chalk.blue(round_interval))
                logger.info(`[${chalk.blue(myProfile.user_id)}]Used Currency      : ` + chalk.blue(used_currency_id))
                logger.info(`[${chalk.blue(myProfile.user_id)}]User Played Rounds : ` + chalk.blue(user_played_rounds))
                let totalPlayed = user_played_rounds
                let betAmount = Math.floor(Math.round(myProfile.coins_balance / 1000)) - 1
                while (totalPlayed < max_rounds) {
                    logger.info(`[${chalk.blue(myProfile.user_id)}][GAME] Join tournament ${title}`)
                    const isJoin = await apiTrading.joinTournament(id)
                    if (!isJoin) break
                    logger.info(`[${chalk.blue(myProfile.user_id)}][GAME] Playing round ${totalPlayed}`)
                    try {
                        await waitForSeconds(round_interval)
                        const openposition = await apiTrading.openTradingPosition(id, used_currency_id, betAmount.toString())
                        if (openposition.translation_key === "") {
                            betAmount--
                        } else {
                            if (openposition.translation_key === "flutter.amount_less_than_minimum" || openposition.translation_key === "flutter.open_amount_less_than_zero") {
                                logger.error(`[${chalk.blue(myProfile.user_id)}][GAME] Balance less than minimum, exit tournament`)
                                break;
                            }
                            await waitForSeconds(round_interval * 4)
                            const closeposition = await apiTrading.closeTradingPosition(openposition.id)
                            await waitForSeconds(round_interval + 1)
                        }

                    } catch (err) {
                        betAmount--
                    } finally {
                        tournaments = await apiTrading.getTradingTournaments()
                        myProfile = await apiTrading.getProfileSelf()
                        totalPlayed = tournaments.items.filter((tournament) => tournament.id === id)[0].user_played_rounds
                        logger.success(`[${chalk.blue(myProfile.user_id)}][BALANCE] ${myProfile.coins_balance}`)
                        await apiTrading.getPositionLeaderboardTrading(id)
                        if (myProfile.coins_balance < 10000) {
                            logger.warn(`[${chalk.blue(myProfile.user_id)}][GAME] Balance coin less than minimum`)
                            break;
                        }
                    }
                }
                logger.success(`[${chalk.blue(myProfile.user_id)}][GAME] Reach maximum round at tournament ${title}`)
            }
            logger.success(`[${chalk.blue(myProfile.user_id)}]Finish all tournaments`)
        })

        await Promise.all(tradingStart)
        resolve(true)
    })
}

// Helper function to check if the current time is between the start and end dates
function isWithinDateRange(startDate, endDate) {
    const now = new Date();  // Get the current time
    const start = new Date(startDate);  // Convert start_date to Date object
    const end = new Date(endDate);      // Convert end_date to Date object

    return now >= start && now <= end;  // Check if the current time is within the range
}

// Function to check if the user can join the tournament
function canJoinTournament(myProfile, tournament) {
    // Check if the tournament is within date range, has the correct status, user level meets the requirement, and the user hasn't joined yet
    if (
        isWithinDateRange(tournament.start_date, tournament.end_date) &&  // Tournament is currently ongoing
        myProfile.level >= tournament.min_user_level
    ) {
        return true;  // The user can join the tournament
    } else {
        return false; // The user cannot join
    }
}

// Function to find all tournaments the user can join
function getJoinableTournaments(myProfile, tournaments) {
    const joinableTournaments = tournaments.filter(tournament => canJoinTournament(myProfile, tournament));
    return joinableTournaments;
}

function sleeping(seconds) {
    return new Promise(resolve => {
        let remainingTime = seconds;

        const interval = setInterval(() => {
            process.stdout.write(`\rCooldown... waiting for ${remainingTime} seconds`); // \r returns to the beginning of the line
            remainingTime--;

            if (remainingTime < 0) {
                clearInterval(interval);
                process.stdout.write('\rCooldown finished!              \n'); // Clear the line and move to a new one
                resolve();
            }
        }, 1000);  // Update every second
    });
}

(async () => {
    while (true) {
        await main();
        // await sleeping(cooldownTime); // berdasarkan last account cooldown
        await sleeping(300)
    }
})();