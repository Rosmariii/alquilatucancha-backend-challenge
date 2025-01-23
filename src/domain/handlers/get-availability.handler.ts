import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

import {
  ClubWithAvailability,
  GetAvailabilityQuery,
} from '../commands/get-availaiblity.query';
import {
  ALQUILA_TU_CANCHA_CLIENT,
  AlquilaTuCanchaClient,
} from '../ports/aquila-tu-cancha.client';
@QueryHandler(GetAvailabilityQuery)
export class GetAvailabilityHandler
  implements IQueryHandler<GetAvailabilityQuery>
{
  constructor(
    //@ts-ignore
    @Inject(ALQUILA_TU_CANCHA_CLIENT)
    private readonly alquilaTuCanchaClient: AlquilaTuCanchaClient,
    //@ts-ignore
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async execute(
    query: GetAvailabilityQuery,
  ): Promise<ClubWithAvailability[] | any> {
    const cacheKey = `availability:${query.placeId}:${query.date}`;
    const cachedData = await this.cacheManager.get(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const clubs_with_availability: ClubWithAvailability[] = [];
    const clubs = await this.alquilaTuCanchaClient.getClubs(query.placeId);
    for (const club of clubs) {
      const courts = await this.alquilaTuCanchaClient.getCourts(club.id);
      const courts_with_availability: ClubWithAvailability['courts'] = [];
      for (const court of courts) {
        const slots = await this.alquilaTuCanchaClient.getAvailableSlots(
          club.id,
          court.id,
          query.date,
        );
        courts_with_availability.push({
          ...court,
          available: slots,
        });
      }
      clubs_with_availability.push({
        ...club,
        courts: courts_with_availability,
      });
    }

    await this.cacheManager.set(cacheKey, clubs_with_availability, 300000);
    return clubs_with_availability;
  }
}
