import axios from 'axios';
import { requestError } from '@/errors';

async function get(url: string) {
  try {
    const result = await axios.get(url);
    return result;
  } catch (error) {
    console.log(error)
    const { status, statusText } = error.response;
    throw requestError(status, statusText);
  }
}

export const request = {
  get,
};