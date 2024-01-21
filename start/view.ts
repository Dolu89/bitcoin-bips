import edge from 'edge.js'
import app from '@adonisjs/core/services/app'
import BipService from '#services/bip_service'

const service = await app.container.make(BipService)
edge.global('lastUpdate', await service.getLastUpdate())
