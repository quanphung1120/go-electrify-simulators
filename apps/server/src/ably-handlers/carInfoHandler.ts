import { SharedState } from "../state";
import { ABLY_EVENTS } from "@go-electrify/shared-types";

export const registerCarInfoHandler = (
  channel: any,
  state: SharedState
): void => {
  const handleLoadCarInfo = (message: any): void => {
    console.log("Load car info event received:", message.data);

    const publishData = {
      currentCapacity: state.currentCapacity,
      maxCapacity: state.maxCapacity,
      timestamp: new Date().toISOString(),
    };

    console.log("Publishing car info to Ably:", publishData);
    channel.publish(ABLY_EVENTS.CAR_INFO, publishData);
  };

  channel.subscribe(ABLY_EVENTS.LOAD_CAR_INFO, handleLoadCarInfo);
};
