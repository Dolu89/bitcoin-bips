import { BentoCache, bentostore } from 'bentocache'
import { fileDriver } from "bentocache/drivers/file";

export default new BentoCache({
    default: 'filesystem',
    stores: {
        filesystem: bentostore().useL2Layer(fileDriver({
            directory: './cache'
        }))
    }
})