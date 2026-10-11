const deliveryRepository = require('../repositories/deliveryRepository');
const notificationService = require('./notificationService');

class DeliveryService {
  toDto(d) {
    if (!d) return null;
    return {
      id: d.id,
      claimId: d.claim_id,
      volunteerId: d.volunteer_id,
      volunteerName: d.volunteer_name,
      status: d.status,
      createdAt: d.created_at,
      pickedUpAt: d.picked_up_at,
      deliveredAt: d.delivered_at,
      listing: {
        id: d.listing_id,
        title: d.listing_title,
        category: d.category,
        quantity: d.quantity,
        unit: d.unit,
        pickupAddress: d.pickup_address,
        pickupWindow: d.pickup_window,
        donorName: d.donor_name,
        donorEmail: d.donor_email
      },
      ngo: {
        id: d.ngo_id,
        name: d.ngo_name,
        organisationName: d.ngo_org_name,
        deliveryAddress: d.ngo_address
      }
    };
  }

  async getAvailableTasks() {
    const tasks = await deliveryRepository.findAvailableTasks();
    return tasks.map(t => ({
      claimId: t.claim_id,
      listingId: t.listing_id,
      title: t.listing_title,
      category: t.category,
      quantity: t.quantity,
      unit: t.unit,
      pickupAddress: t.pickup_address,
      pickupWindow: t.pickup_window,
      donorName: t.donor_name,
      ngoName: t.ngo_name,
      ngoOrgName: t.ngo_org_name,
      ngoAddress: t.ngo_address,
      claimedAt: t.claimed_at
    }));
  }

  async getVolunteerDeliveries(volunteerId) {
    const list = await deliveryRepository.findByVolunteerId(volunteerId);
    return list.map(d => this.toDto(d));
  }

  async acceptTask(claimId, volunteerId) {
    const delivery = await deliveryRepository.assignTask(claimId, volunteerId);

    // Notify donor & NGO (FR-7)
    if (delivery.donor_id) {
      await notificationService.notify(
        delivery.donor_id,
        `Volunteer "${delivery.volunteer_name}" has accepted pickup for "${delivery.listing_title}".`,
        'INFO'
      );
    }

    if (delivery.ngo_id) {
      await notificationService.notify(
        delivery.ngo_id,
        `Volunteer "${delivery.volunteer_name}" is assigned to deliver "${delivery.listing_title}".`,
        'INFO'
      );
    }

    return this.toDto(delivery);
  }

  async markPickedUp(deliveryId, volunteerId) {
    const delivery = await deliveryRepository.markPickedUp(deliveryId, volunteerId);

    if (delivery.donor_id) {
      await notificationService.notify(
        delivery.donor_id,
        `Your surplus food "${delivery.listing_title}" was picked up by volunteer "${delivery.volunteer_name}".`,
        'INFO'
      );
    }

    if (delivery.ngo_id) {
      await notificationService.notify(
        delivery.ngo_id,
        `"${delivery.listing_title}" has been picked up from donor and is on the way to your location!`,
        'INFO'
      );
    }

    return this.toDto(delivery);
  }

  async markDelivered(deliveryId, volunteerId) {
    const delivery = await deliveryRepository.markDelivered(deliveryId, volunteerId);

    if (delivery.donor_id) {
      await notificationService.notify(
        delivery.donor_id,
        `Mission complete! "${delivery.listing_title}" was delivered safely to ${delivery.ngo_org_name || 'the NGO'}. Thank you for preventing food waste!`,
        'SUCCESS'
      );
    }

    if (delivery.ngo_id) {
      await notificationService.notify(
        delivery.ngo_id,
        `Food delivery for "${delivery.listing_title}" is complete! Enjoy the surplus meal distribution.`,
        'SUCCESS'
      );
    }

    return this.toDto(delivery);
  }
}

module.exports = new DeliveryService();
