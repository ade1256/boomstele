import axios from "axios";
import chalk from "chalk"
import { SocksProxyAgent } from "socks-proxy-agent";

export class Logger {
    info(message) {
        console.log(chalk.white(`${new Date().toISOString()} [INFO]: ${message}`));
    }

    success(message) {
        console.log(chalk.green(`${new Date().toISOString()} [SUCCESS]: ${message}`));
    }

    warn(message) {
        console.log(chalk.yellow(`${new Date().toISOString()} [WARN]: ${message}`));
    }

    error(message) {
        console.log(chalk.red(`${new Date().toISOString()} [ERROR]: ${message}`));
    }

    debug(message) {
        console.log(chalk.magenta(`${new Date().toISOString()} [DEBUG]: ${message}`));
    }
}

const logger = new Logger();

export class ProxyScraper {
    async getProxy() {
        try {
            const response = await axios.get('https://raw.githubusercontent.com/officialputuid/KangProxy/KangProxy/xResults/RAW.txt');
            const proxies = response.data;
            return proxies.split("\n");
        } catch (error) {
            console.error('Error fetching proxies:', error);
            throw error;
        }
    }
    async checkProxy(agent) {
        try {
            const start = Date.now();
            const response = await axios.get("https://httpbin.org/status/200", { httpAgent: agent, httpsAgent: agent });
            const duration = Date.now() - start;

            if (response) {
                return {
                    isLive: true,
                    duration,
                };
            }
        } catch (error) {
            return {
                isLive: false,
                duration: 99999999, // dead
            };
        }
    }

    async getLiveProxy() {
        logger.info("Searching proxy and validating...")
        const SOCKS5_PROXIES = await this.getProxy()
        const liveProxies = [];
        const proxyPromises = SOCKS5_PROXIES.map(async (item) => {
            if (item.includes('socks5') || item.includes('socks4')) {
                const proxy = item;
                const agent = new SocksProxyAgent(proxy);
                const { isLive, duration } = await this.checkProxy(agent);
                if (isLive && duration < 10000) {
                    liveProxies.push(item)
                }
            }
        });

        // Wait for all promises to resolve
        await Promise.all(proxyPromises);
        logger.success('All proxies have been checked. Total live and fast proxy '+ liveProxies.length);
        return liveProxies
    }
}

export class API {
    constructor(initData, proxyAgent = null) {
        // Initialize axios instance as a class property
        this.axiosInstance = axios.create({
            baseURL: 'https://api.booms.io'
        });

        if(proxyAgent) {
            this.axiosInstance.defaults.httpAgent = proxyAgent
            this.axiosInstance.defaults.httpsAgent = proxyAgent
            logger.success(`Using proxy socks`)
        } else {
            logger.info(`No using proxy.`)
        }

        // Store initData as a class property if needed for other methods
        this.initData = initData;
        this.proxy = proxyAgent
    }

    // Define createSession method
    async createSession() {
        logger.info("Trying login..")
        const url = '/v1/auth/create-session';

        // Make a POST request to create a session
        const response = await this.axiosInstance.post(url, {
            "telegram_init_data": this.initData,
            "start_parameter": "bro6901021270"
        });

        // Extract the token from the response
        const token = response.data.token;

        // Set the token in the axiosInstance default headers
        this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        logger.success("Successfully sign in")
        return token; // Return the token if needed
    }

    async getProfileBoosts() {
        const url = '/v1/profiles/boosts'
        const response = await this.axiosInstance.get(url)
        /**
         * Returning object
         */
        logger.info(`Loaded boost list`)
        return response.data
    }

    async submitBoost(key) {
        try {
            const url = `/v1/profiles/boosts/${key}/submit`
            const response = await this.axiosInstance.post(url)
            /**
             * Returning object
             */
            if (key !== "refill_energy") {
                logger.info(`upgrade boost ${response.data[key].name} to ${response.data[key].current_level}`)
            } else {
                logger.info(`submit refill energy, current available ${response.data[key].current_available}/${response.data[key].max_available}`)
            }
            return response.data
        } catch (error) {
            logger.error(`Saldo tidak cukup untuk upgrade`)
            return new Error(`Saldo tidak cukup untuk upgrade`)
        }
    }

    async getTaskList(){
        const url = '/v1/tasks'
        const response = await this.axiosInstance.get(url)
        /**
         * return object
         * items [{ 
         *      category, conditions[], id, rewards[], starts_in, title
         * }]
         */
        logger.info(`Loaded task list`)
        return response.data
    }

    async submitTask(id) {
        try {
            const url = `/v1/tasks/${id}/submit`
            const response = await this.axiosInstance.post(url)
            logger.success(`Task ${id}: Berhasil submit task`)
            return response.data
        } catch (error) {
            logger.error(`Task ${id}: ${error.response.data.message}`)
        }
    }

    async getProfileSelf() {
        const url = '/v1/profiles/self'
        const response = await this.axiosInstance.get(url)
        logger.info(`Loaded profile`)
        return response.data /** {coins_balance, coins_multiplier, energy_current_value, energy_max_value, level, name, user_id} */
    }

    async getDailyRewards() {
        const url = '/v1/tasks/daily-reward'
        const response = await this.axiosInstance.get(url)
        logger.info(`Loaded daily reward`)
        return response.data
    }

    async submitDailyReward() {
        const url = '/v1/tasks/daily-reward'
        const response = await this.axiosInstance.post(url)
        logger.success(`Claim daily reward login`)
        return response.data
    }

    async getTradingTournaments() {
        const url = '/v1/trading/tournaments'
        const response = await this.axiosInstance.get(url)
        logger.info(`Loaded tournament list`)
        return response.data
    }

    async getLevels() {
        const url = '/v1/profiles/levels'
        const response = await this.axiosInstance.get(url)
        logger.info(`Loaded profile levels`)
        return response.data
    }

    async getBalances() {
        const url = '/v1/balances'
        const response = await this.axiosInstance.get(url)
        response.data.items.map((item) => {
            logger.info(`Saldo currency ${item.currency_id}: ${chalk.green(item.amount)}`)
        })
        
        return response.data.items
    }

    async actionTapTap(taps_count) {
        const url = '/v1/profiles/tap'
        const body = {
            taps_count: taps_count,// get from enery max value,
            tapped_from: new Date().toISOString()
        }
        const response = await this.axiosInstance.post(url, body)
        // {added_coins, energy_current_value, energy_max_value, energy_used, energy_rate, taps_used}
        process.stdout.write(`\r${new Date().toISOString()} [INFO]: Tap Tap for ${response.data.taps_used}`);
        return response.data
    }

    async checkWallet() {
       try {
           const url = '/v1/wallet/ton/address'
           const response = await this.axiosInstance.get(url)
           return response.data
       } catch (error) {
            // logger.error(error.response.data.message)
            return null
       }
    }

    async addTONWallet() {
        try {
            const url = '/v1/wallet/ton/connect'
            const body = {
                account: {
                    address: "",
                    chain: '-239',
                    wallet_state_init: "",
                    public_key: ""
                }
            }
            const response = await this.axiosInstance.post(url, body)
            logger.info(`Your account wallet is ${response.data.address}`)
            return response.data
        } catch (error) {
            logger.error(error.response.data.message)
        }
    }

    async joinTournament(tournament_id) {
        try {
            const url = `/v1/trading/tournament/${tournament_id}/join`
            const response = await this.axiosInstance.post(url)
            logger.info(`[GAME] Joined tournament`)
            return true
        } catch (err) {
            logger.error("Cannot join tournament:", err.response.data.translation_key)
            return false
        }
    }

    async openTradingPosition(tournament_id, currency_id, open_amount) {
        try {
            const url = `/v1/trading/position/open`
            const response = await this.axiosInstance.post(url, {
                tournament_id,
                currency_id,
                open_amount
            })
            logger.info(`[GAME] Placing order ${response.data.open_amount} coin`)
            return response.data
        } catch(err) {
            return err.response.data
        }
    }
    async closeTradingPosition(position_id) {
        try {
            const url = `/v1/trading/position/close`
            const response = await this.axiosInstance.post(url, {
                position_id,
                tick_time: new Date().getTime()
            })
            const PNL = response.data.close_amount - response.data.open_amount
            logger.info(`[GAME] Close order position. PNL ${PNL > 0 ? chalk.green(PNL):chalk.red(PNL)} || Multiplier ${response.data.multiplier}`)
            return response.data
        } catch (err) {
            logger.error(`[GAME] Lose trading`)
            return err.response.data
        }
    }
    async getPositionLeaderboardTrading(tournament_id) {
        try {
            const url = `/v1/trading/leaderboard/${tournament_id}`
            const response = await this.axiosInstance.get(url)
            logger.info(`[GAME] Tournament position. ${chalk.yellow(`#${response.data.user_position}`)}/${response.data.max}`)
            return response.data
        } catch (err) {
            logger.error("Cannot get leaderboard trading")
        }
    }
}