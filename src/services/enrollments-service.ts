import { Address, Enrollment } from '@prisma/client';
import { request } from '@/utils/request';
import { notFoundError, requestError } from '@/errors';
import { addressRepository, CreateAddressParams, enrollmentRepository, CreateEnrollmentParams } from '@/repositories';
import { exclude } from '@/utils/prisma-utils';
import * as HttpStatus from 'http-status-codes';



// TODO - Receber o CEP por parâmetro nesta função.
async function getAddressFromCEP(cep : string) {
  // FIXME: está com CEP fixo!
  const viaCepApi = process.env.VIA_CEP_API

  if (!viaCepApi) {throw new Error("Variável de ambiente VIA_CEP_API não definida")}

  const url = `${viaCepApi}/${cep}/json/`;

  const result = await request.get(url);

  if (!result.data) {
    throw new Error("Variável de ambiente VIA_CEP_API não definida");
  }

  if (!result.data || result.status === 400 || (result.data.erro === true)) {
    throw requestError(400, "Bad request");
  }
  const responseCep = {
    logradouro: result.data.logradouro,
    complemento: result.data.complemento,
    bairro: result.data.bairro,
    cidade: result.data.localidade,
    uf: result.data.uf,
  };

 
  return responseCep;
}



async function getOneWithAddressByUserId(userId: number): Promise<GetOneWithAddressByUserIdResult> {
  const enrollmentWithAddress = await enrollmentRepository.findWithAddressByUserId(userId);

  if (!enrollmentWithAddress) throw requestError(400, "Bad Request");

  const [firstAddress] = enrollmentWithAddress.Address;
  const address = getFirstAddress(firstAddress);

  return {
    ...exclude(enrollmentWithAddress, 'userId', 'createdAt', 'updatedAt', 'Address'),
    ...(!!address && { address }),
  };
}

type GetOneWithAddressByUserIdResult = Omit<Enrollment, 'userId' | 'createdAt' | 'updatedAt'>;

function getFirstAddress(firstAddress: Address): GetAddressResult {
  if (!firstAddress) return null;

  return exclude(firstAddress, 'createdAt', 'updatedAt', 'enrollmentId');
}

type GetAddressResult = Omit<Address, 'createdAt' | 'updatedAt' | 'enrollmentId'>;

async function createOrUpdateEnrollmentWithAddress(params: CreateOrUpdateEnrollmentWithAddress) {
  const enrollment = exclude(params, 'address');
  enrollment.birthday = new Date(enrollment.birthday);
  const address = getAddressForUpsert(params.address);
  const cep = address.cep;
  const viaCepApi = process.env.VIA_CEP_API
  const validateCep = await getAddressFromCEP(cep)
  // getAddressFromCEP(cep)
  // TODO - Verificar se o CEP é válido antes de associar ao enrollment.

  if (!validateCep) {throw requestError(400,"Bad Request")}

  const newEnrollment = await enrollmentRepository.upsert(params.userId, enrollment, exclude(enrollment, 'userId'));

  await addressRepository.upsert(newEnrollment.id, address, address);
}

function getAddressForUpsert(address: CreateAddressParams) {
  return {
    ...address,
    ...(address?.addressDetail && { addressDetail: address.addressDetail }),
  };
}

export type CreateOrUpdateEnrollmentWithAddress = CreateEnrollmentParams & {
  address: CreateAddressParams;
};

export const enrollmentsService = {
  getOneWithAddressByUserId,
  createOrUpdateEnrollmentWithAddress,
  getAddressFromCEP,
};
