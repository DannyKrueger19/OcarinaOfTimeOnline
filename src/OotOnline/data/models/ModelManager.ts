import {
  IModLoaderAPI,
  ModLoaderEvents,
} from 'modloader64_api/IModLoaderAPI';
import {
  EventHandler,
  EventsServer,
  EventsClient,
  EventServerJoined,
} from 'modloader64_api/EventHandler';
import { OotOnlineStorageClient } from '../../OotOnlineStorageClient';
import { zzstatic } from './zzstatic/src/zzstatic';
import zlib from 'zlib';
import {
  Ooto_AllocateModelPacket,
  Ooto_IconAllocatePacket,
  OotO_GiveModelPacket,
} from '../OotOPackets';
import { Age, OotEvents, IOOTCore } from 'modloader64_api/OOT/OOTAPI';
import {
  INetworkPlayer,
  NetworkHandler,
} from 'modloader64_api/NetworkHandler';
import { OotOnlineEvents, ICustomEquipment } from '../../OotoAPI/OotoAPI';
import { ModelPlayer } from './ModelPlayer';
import { ModelAllocationManager } from './ModelAllocationManager';
import { Puppet } from '../linkPuppet/Puppet';
import fs from 'fs';
import { ModelThread } from './ModelThread';
import { ModLoaderAPIInject } from 'modloader64_api/ModLoaderAPIInjector';
import path from 'path';
import { Postinit, onTick } from 'modloader64_api/PluginLifecycle';
import { ModelObject } from './ModelContainer';
import { ModelEquipmentPackager } from './ModelEquipmentPackager';
import { PatchTypes } from 'modloader64_api/Patchers/PatchManager';
import { Z64RomTools } from 'Z64Lib/API/Z64RomTools';
import { InjectCore } from 'modloader64_api/CoreInjection';
import { MatrixTranslate } from './MatrixTranslate';
import { trimBuffer } from './trimBuffer';

export class FilePatch {
  offset: number;
  value: number;

  constructor(offset: number, value: number) {
    this.offset = offset;
    this.value = value;
  }
}

export class RomPatch {
  index: number;
  data: FilePatch[] = new Array<FilePatch>();

  constructor(index: number) {
    this.index = index;
  }
}

export class ModelManagerClient {
  @ModLoaderAPIInject()
  ModLoader!: IModLoaderAPI;
  @InjectCore()
  core!: IOOTCore;
  clientStorage!: OotOnlineStorageClient;
  allocationManager: ModelAllocationManager;
  customModelFileAdult = '';
  customModelFileChild = '';
  customModelFileEquipment = '';
  customModelFileDesc = '';
  customModelFileAnims = '';
  customModelRepointsAdult = __dirname + '/zobjs/adult.json';
  customModelRepointsChild = __dirname + '/zobjs/child.json';
  customModelFileAdultIcon = '';
  customModelFileChildIcon = '';
  customIconsFile = '';
  cacheDir: string = "./cache";
  equipmentAdultMap: Map<string, Array<number>> = new Map<string, Array<number>>();
  equipmentChildMap: Map<string, Array<number>> = new Map<string, Array<number>>();
  equipmentIndex = -1;
  equipmentMetadata: any = {};
  colorProxies: Array<number> = [];
  lastSeenTunic: number = 0;
  matrices: Map<string, Buffer> = new Map<string, Buffer>();

  constructor() {
    this.allocationManager = new ModelAllocationManager();
    let d: any = JSON.parse(fs.readFileSync(path.join(__dirname, "DlistMap.json")).toString());
    Object.keys(d.adult).forEach((key: string) => {
      this.equipmentAdultMap.set(key, []);
      Object.keys(d.adult[key]).forEach((i: string) => {
        this.equipmentAdultMap.get(key)!.push(parseInt(d.adult[key][i]));
      })
    });
    Object.keys(d.child).forEach((key: string) => {
      this.equipmentChildMap.set(key, []);
      Object.keys(d.child[key]).forEach((i: string) => {
        this.equipmentChildMap.get(key)!.push(parseInt(d.child[key][i]));
      })
    });
  }

  @EventHandler(OotOnlineEvents.CUSTOM_ICONS_APPLIED)
  CUSTOM_ICONS_APPLIED(file: string) {
    this.customIconsFile = file;
  }

  @EventHandler(OotOnlineEvents.CUSTOM_MODEL_APPLIED_ADULT_MATRIX_SWORD_BACK)
  CUSTOM_MODEL_APPLIED_ADULT_MATRIX_SWORD_BACK(arr: number[]) {
    let mt: MatrixTranslate = new MatrixTranslate();
    this.matrices.set(OotOnlineEvents.CUSTOM_MODEL_APPLIED_ADULT_MATRIX_SWORD_BACK, mt.guMtxF2L(mt.guRTSF(arr[0], arr[1], arr[2], arr[3], arr[4], arr[5], arr[6])));
  }

  @EventHandler(OotOnlineEvents.CUSTOM_MODEL_APPLIED_ADULT_MATRIX_SHIELD_BACK)
  CUSTOM_MODEL_APPLIED_ADULT_MATRIX_SHIELD_BACK(arr: number[]) {
    let mt: MatrixTranslate = new MatrixTranslate();
    this.matrices.set(OotOnlineEvents.CUSTOM_MODEL_APPLIED_ADULT_MATRIX_SHIELD_BACK, mt.guMtxF2L(mt.guRTSF(arr[0], arr[1], arr[2], arr[3], arr[4], arr[5], arr[6])));
  }

  @EventHandler(OotOnlineEvents.CUSTOM_MODEL_APPLIED_CHILD_MATRIX_SWORD_BACK)
  CUSTOM_MODEL_APPLIED_CHILD_MATRIX_SWORD_BACK(arr: number[]) {
    let mt: MatrixTranslate = new MatrixTranslate();
    this.matrices.set(OotOnlineEvents.CUSTOM_MODEL_APPLIED_CHILD_MATRIX_SWORD_BACK, mt.guMtxF2L(mt.guRTSF(arr[0], arr[1], arr[2], arr[3], arr[4], arr[5], arr[6])));
  }

  @EventHandler(OotOnlineEvents.CUSTOM_MODEL_APPLIED_CHILD_MATRIX_SHIELD_BACK)
  CUSTOM_MODEL_APPLIED_CHILD_MATRIX_SHIELD_BACK(arr: number[]) {
    let mt: MatrixTranslate = new MatrixTranslate();
    this.matrices.set(OotOnlineEvents.CUSTOM_MODEL_APPLIED_CHILD_MATRIX_SHIELD_BACK, mt.guMtxF2L(mt.guRTSF(arr[0], arr[1], arr[2], arr[3], arr[4], arr[5], arr[6])));
  }

  @EventHandler(OotOnlineEvents.CUSTOM_MODEL_APPLIED_CHILD_MATRIX_ITEM_SHIELD)
  CUSTOM_MODEL_APPLIED_CHILD_MATRIX_ITEM_SHIELD(arr: number[]) {
    let mt: MatrixTranslate = new MatrixTranslate();
    this.matrices.set(OotOnlineEvents.CUSTOM_MODEL_APPLIED_CHILD_MATRIX_ITEM_SHIELD, mt.guMtxF2L(mt.guRTSF(arr[0], arr[1], arr[2], arr[3], arr[4], arr[5], arr[6])));
  }

  @EventHandler(OotOnlineEvents.CUSTOM_MODEL_APPLIED_ADULT)
  onCustomModel(file: string) {
    this.customModelFileAdult = file;
  }

  @EventHandler(OotOnlineEvents.CUSTOM_MODEL_APPLIED_CHILD)
  onCustomModel2(file: string) {
    this.customModelFileChild = file;
  }

  @EventHandler(OotOnlineEvents.CUSTOM_MODEL_APPLIED_ANIMATIONS)
  onCustomModel3(file: string) {
    this.customModelFileAnims = file;
  }

  @EventHandler(OotOnlineEvents.CUSTOM_MODEL_APPLIED_ICON_ADULT)
  onCustomModel4(file: string) {
    this.customModelFileAdultIcon = file;
  }

  @EventHandler(OotOnlineEvents.CUSTOM_MODEL_APPLIED_ICON_CHILD)
  onCustomModel5(file: string) {
    this.customModelFileChildIcon = file;
  }

  @EventHandler(OotOnlineEvents.CUSTOM_MODEL_APPLIED_EQUIPMENT)
  onCustomModel6(data: ICustomEquipment) {
    this.customModelFileEquipment = data.zobj;
    this.customModelFileDesc = data.txt;
  }

  @Postinit()
  loadEquipment() {
    if (this.customModelFileEquipment !== '') {
      let model = this.allocationManager.getModelInSlot(this.equipmentIndex);
      let allocation_size = 0x37800;
      let addr: number = 0x800000 + allocation_size * this.equipmentIndex;
      let buf: Buffer = new zzstatic().doRepoint(model.model.equipment.zobj, this.equipmentIndex);
      this.ModLoader.emulator.rdramWriteBuffer(addr, buf);
    }
    this.ModLoader.clientSide.sendPacket(new OotO_GiveModelPacket(this.ModLoader.clientLobby, this.ModLoader.me));
  }

  @EventHandler(OotEvents.ON_LOADING_ZONE)
  onLoadingZone(evt: any) {
    if (this.customModelFileEquipment !== '') {
      let model = this.allocationManager.getModelInSlot(this.equipmentIndex);
      let allocation_size = 0x37800;
      let addr: number = 0x800000 + allocation_size * this.equipmentIndex;
      this.ModLoader.emulator.rdramWriteBuffer(addr, new zzstatic().doRepoint(model.model.equipment.zobj, this.equipmentIndex));
    }
  }

  @onTick()
  onTick() {
    if (this.lastSeenTunic !== this.core.link.tunic) {
      this.lastSeenTunic = this.core.link.tunic;
      let addr = 0x000f7ad8 + this.core.link.tunic * 3;
      let color: Buffer = this.ModLoader.emulator.rdramReadBuffer(addr, 0x3);
      for (let i = 0; i < this.colorProxies.length; i++) {
        this.ModLoader.emulator.rdramWriteBuffer(this.colorProxies[i], color);
      }
    }
  }

  loadAdultModel(evt: any, file: string) {
    let tools: Z64RomTools = new Z64RomTools(this.ModLoader, 0x7430);
    let adult = 502;
    let code = 27;
    this.ModLoader.logger.info('Loading new Link model (Adult)...');
    let adult_model: Buffer = fs.readFileSync(file);
    let a_copy: Buffer = Buffer.alloc(adult_model.byteLength);
    adult_model.copy(a_copy);
    if (this.customModelFileEquipment !== '') {
      let ms_blade_addr: number = -1;
      Object.keys(this.equipmentMetadata).forEach((key: string) => {
        if (this.equipmentAdultMap.has(key)) {
          this.ModLoader.logger.info("Loading dlist replacement for " + key + ".");
          let model = this.allocationManager.getModelInSlot(this.equipmentIndex)
          let offset: number = model.model.equipment.zobj.byteLength;
          let proxy: Buffer = fs.readFileSync(path.join(__dirname, "color_fix_dlist_template.bin"));
          let target: number = proxy.indexOf(Buffer.from("DEADBEEF", 'hex'));
          proxy.writeUInt32BE(this.equipmentMetadata[key], target);

          // Expand the buffer.
          let replacement: Buffer = Buffer.alloc(model.model.equipment.zobj.byteLength + proxy.byteLength);
          model.model.equipment.zobj.copy(replacement);
          model.model.equipment.zobj = replacement;

          proxy.copy(model.model.equipment.zobj, offset);
          let allocation_size = 0x37800;
          let addr: number = 0x80800000 + allocation_size * this.equipmentIndex;
          addr += offset;
          offset += proxy.byteLength;
          for (let i = 0; i < this.equipmentAdultMap.get(key)!.length; i++) {
            a_copy.writeUInt32BE(addr, this.equipmentAdultMap.get(key)![i] + 0x4);
          }
          this.colorProxies.push(addr + 0x14);
        }
      });
      // Load any matrix data.
      if (this.matrices.has(OotOnlineEvents.CUSTOM_MODEL_APPLIED_ADULT_MATRIX_SWORD_BACK)) {
        this.ModLoader.logger.debug("Applying sword back matrix...");
        this.matrices.get(OotOnlineEvents.CUSTOM_MODEL_APPLIED_ADULT_MATRIX_SWORD_BACK)!.copy(a_copy, 0x5010);
        this.matrices.get(OotOnlineEvents.CUSTOM_MODEL_APPLIED_ADULT_MATRIX_SWORD_BACK)!.copy(adult_model, 0x5010);
      }
      if (this.matrices.has(OotOnlineEvents.CUSTOM_MODEL_APPLIED_ADULT_MATRIX_SHIELD_BACK)) {
        this.ModLoader.logger.debug("Applying shield back matrix...");
        this.matrices.get(OotOnlineEvents.CUSTOM_MODEL_APPLIED_ADULT_MATRIX_SHIELD_BACK)!.copy(a_copy, 0x5050);
        this.matrices.get(OotOnlineEvents.CUSTOM_MODEL_APPLIED_ADULT_MATRIX_SHIELD_BACK)!.copy(adult_model, 0x5050);
      }
    }
    let adult_zobj = tools.decompressFileFromRom(evt.rom, adult);
    let hash: string = this.ModLoader.utils.hashBuffer(adult_zobj);
    if (hash !== "fda5c759635bfa85f9077d0ee0d8bbb5") {
      this.ModLoader.logger.warn("The adult zobj in this rom isn't vanilla. Stopping custom model processing.");
      this.ModLoader.logger.warn(hash);
      return;
    }
    this.ModLoader.utils.clearBuffer(adult_zobj);
    a_copy.copy(adult_zobj);
    tools.recompressFileIntoRom(evt.rom, adult, trimBuffer(adult_zobj));

    let patch: RomPatch[] = new Array<RomPatch>();
    patch = JSON.parse(fs.readFileSync(this.customModelRepointsAdult).toString());
    for (let i = 0; i < patch.length; i++) {
      let buf: Buffer = tools.decompressFileFromRom(evt.rom, patch[i].index);
      for (let j = 0; j < patch[i].data.length; j++) {
        buf[patch[i].data[j].offset] = patch[i].data[j].value;
      }
      tools.recompressFileIntoRom(evt.rom, patch[i].index, buf);
    }
    let code_file: Buffer = tools.decompressFileFromRom(evt.rom, code);
    adult_model.writeUInt32BE(code_file.readUInt32BE(0xe65a0), 0x500c);
    this.clientStorage.adultModel = adult_model;
  }

  loadChildModel(evt: any, file: string) {
    let tools: Z64RomTools = new Z64RomTools(this.ModLoader, 0x7430);
    let child = 503;
    let code = 27;
    let offset = 0xe65a0;
    this.ModLoader.logger.info('Loading new Link model (Child)...');
    let child_model: Buffer = fs.readFileSync(file);
    let a_copy: Buffer = Buffer.alloc(child_model.byteLength);
    child_model.copy(a_copy);

    if (this.customModelFileEquipment !== '') {
      Object.keys(this.equipmentMetadata).forEach((key: string) => {
        if (this.equipmentChildMap.has(key)) {
          this.ModLoader.logger.info("Loading dlist replacement for " + key + ".");
          let model = this.allocationManager.getModelInSlot(this.equipmentIndex)
          let offset: number = model.model.equipment.zobj.byteLength;
          let proxy: Buffer = fs.readFileSync(path.join(__dirname, "color_fix_dlist_template.bin"));
          let target: number = proxy.indexOf(Buffer.from("DEADBEEF", 'hex'));
          proxy.writeUInt32BE(this.equipmentMetadata[key], target);

          // Expand the buffer.
          let replacement: Buffer = Buffer.alloc(model.model.equipment.zobj.byteLength + proxy.byteLength);
          model.model.equipment.zobj.copy(replacement);
          model.model.equipment.zobj = replacement;

          proxy.copy(model.model.equipment.zobj, offset);
          let allocation_size = 0x37800;
          let addr: number = 0x80800000 + allocation_size * this.equipmentIndex;
          addr += offset;
          for (let i = 0; i < this.equipmentChildMap.get(key)!.length; i++) {
            a_copy.writeUInt32BE(addr, this.equipmentChildMap.get(key)![i] + 0x4);
          }
          this.colorProxies.push(addr + 0x14);
        }
      });
      // Load any matrix data.
      if (this.matrices.has(OotOnlineEvents.CUSTOM_MODEL_APPLIED_CHILD_MATRIX_SWORD_BACK)) {
        this.matrices.get(OotOnlineEvents.CUSTOM_MODEL_APPLIED_CHILD_MATRIX_SWORD_BACK)!.copy(a_copy, 0x5010);
        this.matrices.get(OotOnlineEvents.CUSTOM_MODEL_APPLIED_CHILD_MATRIX_SWORD_BACK)!.copy(child_model, 0x5010);
      }
      if (this.matrices.has(OotOnlineEvents.CUSTOM_MODEL_APPLIED_CHILD_MATRIX_SHIELD_BACK)) {
        this.matrices.get(OotOnlineEvents.CUSTOM_MODEL_APPLIED_CHILD_MATRIX_SHIELD_BACK)!.copy(a_copy, 0x5050);
        this.matrices.get(OotOnlineEvents.CUSTOM_MODEL_APPLIED_CHILD_MATRIX_SHIELD_BACK)!.copy(child_model, 0x5050);
      }
      if (this.matrices.has(OotOnlineEvents.CUSTOM_MODEL_APPLIED_CHILD_MATRIX_ITEM_SHIELD)) {
        this.matrices.get(OotOnlineEvents.CUSTOM_MODEL_APPLIED_CHILD_MATRIX_ITEM_SHIELD)!.copy(a_copy, 0x5090);
        this.matrices.get(OotOnlineEvents.CUSTOM_MODEL_APPLIED_CHILD_MATRIX_ITEM_SHIELD)!.copy(child_model, 0x5090);
      }
    }

    let child_zobj = tools.decompressFileFromRom(evt.rom, child);
    let hash: string = this.ModLoader.utils.hashBuffer(child_zobj);
    if (hash !== "ddd916f50c49c55246fe24a05d326013") {
      this.ModLoader.logger.warn("The child zobj in this rom isn't vanilla. Stopping custom model processing.");
      this.ModLoader.logger.warn(hash);
      return;
    }
    this.ModLoader.utils.clearBuffer(child_zobj);
    a_copy.copy(child_zobj);

    tools.recompressFileIntoRom(evt.rom, child, trimBuffer(child_zobj));

    let patch: RomPatch[] = new Array<RomPatch>();
    patch = JSON.parse(fs.readFileSync(this.customModelRepointsChild).toString());
    for (let i = 0; i < patch.length; i++) {
      let buf: Buffer = tools.decompressFileFromRom(evt.rom, patch[i].index);
      for (let j = 0; j < patch[i].data.length; j++) {
        buf[patch[i].data[j].offset] = patch[i].data[j].value;
      }
      tools.recompressFileIntoRom(evt.rom, patch[i].index, buf);
    }

    let code_file: Buffer = tools.decompressFileFromRom(evt.rom, code);
    child_model.writeUInt32BE(code_file.readUInt32BE(offset + 0x4), 0x500c);

    this.clientStorage.childModel = child_model;
  }

  setupPuppetModels(evt: any) {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir);
    }
    let child_path: string = path.join(this.cacheDir, "child.zobj");
    let adult_path: string = path.join(this.cacheDir, "adult.zobj");

    let puppet_child: Buffer = Buffer.alloc(1);
    let puppet_adult: Buffer = Buffer.alloc(1);

    if (fs.existsSync(child_path) && fs.existsSync(adult_path)) {
      puppet_child = fs.readFileSync(child_path);
      puppet_adult = fs.readFileSync(adult_path);
    } else {
      let tools: Z64RomTools = new Z64RomTools(this.ModLoader, 0x7430);
      this.ModLoader.logger.info("Setting up puppet models...");
      puppet_child = Buffer.alloc(0x37800);
      tools.decompressFileFromRom(evt.rom, 503).copy(puppet_child);
      puppet_adult = Buffer.alloc(0x37800);
      tools.decompressFileFromRom(evt.rom, 502).copy(puppet_adult);
      puppet_child = PatchTypes.get(".bps")!.patch(puppet_child, fs.readFileSync(path.join(__dirname, "zobjs", "ChildLink.bps")));
      puppet_adult = PatchTypes.get(".bps")!.patch(puppet_adult, fs.readFileSync(path.join(__dirname, "zobjs", "AdultLink.bps")));
      fs.writeFileSync(child_path, trimBuffer(puppet_child));
      fs.writeFileSync(adult_path, trimBuffer(puppet_adult));
    }

    let a = new ModelPlayer("Adult");
    a.model.adult = new ModelObject(trimBuffer(new zzstatic().doRepoint(puppet_adult, 0)));
    let c = new ModelPlayer("Child");
    c.model.child = new ModelObject(trimBuffer(new zzstatic().doRepoint(puppet_child, 1)));
    this.allocationManager.models[0] = a;
    this.allocationManager.models[1] = c;
  }

  @EventHandler(ModLoaderEvents.ON_ROM_PATCHED_PRE)
  onRomPatchedPre(evt: any) {
    this.setupPuppetModels(evt);
  }

  @EventHandler(ModLoaderEvents.ON_ROM_PATCHED)
  onRomPatched(evt: any) {
    let tools: Z64RomTools = new Z64RomTools(this.ModLoader, 0x7430);
    this.ModLoader.logger.info('Starting custom model setup...');
    let anim = 7;

    if (this.customModelFileEquipment !== '') {
      this.ModLoader.logger.info("Loading new equipment models...");
      let mm: ModelEquipmentPackager = new ModelEquipmentPackager(this.customModelFileEquipment, this.customModelFileDesc);
      let model = new ModelPlayer("Equipment");
      this.clientStorage.equipmentModel = mm.process();
      model.model.equipment = new ModelObject(this.clientStorage.equipmentModel);
      this.equipmentIndex = this.allocationManager.allocateSlot(model);
      let metaSize: number = model.model.equipment.zobj.readUInt32BE(0xC);
      this.equipmentMetadata = JSON.parse(model.model.equipment.zobj.slice(0x310, 0x310 + metaSize).toString());
      let allocation_size = 0x37800;
      let addr: number = 0x80800000 + allocation_size * this.equipmentIndex;
      Object.keys(this.equipmentMetadata).forEach((key: string) => {
        this.equipmentMetadata[key] += addr;
      });
      let def = zlib.deflateSync(this.clientStorage.equipmentModel);
      this.ModLoader.clientSide.sendPacket(
        new Ooto_AllocateModelPacket(
          def,
          0x69,
          this.ModLoader.clientLobby,
          this.ModLoader.utils.hashBuffer(def)
        )
      );
    }

    if (this.customModelFileAdult !== '') {
      this.loadAdultModel(evt, this.customModelFileAdult);
      let def = zlib.deflateSync(this.clientStorage.adultModel);
      this.ModLoader.clientSide.sendPacket(
        new Ooto_AllocateModelPacket(
          def,
          Age.ADULT,
          this.ModLoader.clientLobby,
          this.ModLoader.utils.hashBuffer(def)
        )
      );
    } else {
      if (this.customModelFileEquipment !== '') {
        let adult_path: string = path.join(this.cacheDir, "adult.zobj");
        this.loadAdultModel(evt, adult_path);
      }
    }

    if (this.customModelFileChild !== '') {
      this.loadChildModel(evt, this.customModelFileChild);
      let def = zlib.deflateSync(this.clientStorage.childModel);
      this.ModLoader.clientSide.sendPacket(
        new Ooto_AllocateModelPacket(
          def,
          Age.CHILD,
          this.ModLoader.clientLobby,
          this.ModLoader.utils.hashBuffer(def)
        )
      );
    } else {
      if (this.customModelFileEquipment !== '') {
        let child_path: string = path.join(this.cacheDir, "child.zobj");
        this.loadChildModel(evt, child_path);
      }
    }

    if (this.customModelFileAnims !== '') {
      this.ModLoader.logger.info('Loading new animations...');
      let anim_file: Buffer = fs.readFileSync(this.customModelFileAnims);
      let anim_zobj: Buffer = tools.decompressFileFromRom(evt.rom, anim);
      this.ModLoader.utils.clearBuffer(anim_zobj);
      anim_file.copy(anim_zobj);
      tools.recompressFileIntoRom(evt.rom, anim, anim_zobj);
    }

    if (this.customModelFileAdultIcon !== '') {
      this.ModLoader.logger.info('Loading custom map icon (Adult) ...');
      this.clientStorage.adultIcon = fs.readFileSync(
        this.customModelFileAdultIcon
      );
      let def = zlib.deflateSync(this.clientStorage.adultIcon);
      this.ModLoader.clientSide.sendPacket(
        new Ooto_IconAllocatePacket(
          def,
          Age.ADULT,
          this.ModLoader.clientLobby,
          this.ModLoader.utils.hashBuffer(def)
        )
      );
    }

    if (this.customModelFileChildIcon !== '') {
      this.ModLoader.logger.info('Loading custom map icon (Child) ...');
      this.clientStorage.childIcon = fs.readFileSync(
        this.customModelFileChildIcon
      );
      let def = zlib.deflateSync(this.clientStorage.childIcon);
      this.ModLoader.clientSide.sendPacket(
        new Ooto_IconAllocatePacket(
          def,
          Age.CHILD,
          this.ModLoader.clientLobby,
          this.ModLoader.utils.hashBuffer(def)
        )
      );
    }

    if (this.customIconsFile !== '') {
      let tools: Z64RomTools = new Z64RomTools(this.ModLoader, 0x7430);
      let icons: Buffer = tools.decompressFileFromRom(evt.rom, 8);
      this.ModLoader.utils.clearBuffer(icons);
      fs.readFileSync(this.customIconsFile).copy(icons);
      tools.recompressFileIntoRom(evt.rom, 8, icons);
    }

    this.ModLoader.logger.info('Done.');
  }

  @NetworkHandler('Ooto_AllocateModelPacket')
  onModelAllocate_client(packet: Ooto_AllocateModelPacket) {
    if (
      !this.clientStorage.playerModelCache.hasOwnProperty(packet.player.uuid)
    ) {
      this.clientStorage.playerModelCache[packet.player.uuid] = new ModelPlayer(packet.player.uuid);
    }
    if (packet.age === Age.CHILD) {
      (this.clientStorage.playerModelCache[packet.player.uuid] as ModelPlayer).model.setChild(zlib.inflateSync(packet.model));
      let thread: ModelThread = new ModelThread(
        (this.clientStorage.playerModelCache[packet.player.uuid] as ModelPlayer).model.child.zobj,
        this.ModLoader
      );
      thread.startThread();
      this.ModLoader.logger.info(
        'client: Saving custom child model for player ' +
        packet.player.nickname +
        '.'
      );
    } else if (packet.age === Age.ADULT) {
      (this.clientStorage.playerModelCache[packet.player.uuid] as ModelPlayer).model.setAdult(zlib.inflateSync(packet.model));
      let thread: ModelThread = new ModelThread(
        (this.clientStorage.playerModelCache[packet.player.uuid] as ModelPlayer).model.adult.zobj,
        this.ModLoader
      );
      thread.startThread();
      this.ModLoader.logger.info(
        'client: Saving custom adult model for player ' +
        packet.player.nickname +
        '.'
      );
    } else if (packet.age === 0x69) {
      (this.clientStorage.playerModelCache[packet.player.uuid] as ModelPlayer).model.setEquipment(zlib.inflateSync(packet.model));
      let thread: ModelThread = new ModelThread(
        (this.clientStorage.playerModelCache[packet.player.uuid] as ModelPlayer).model.equipment.zobj,
        this.ModLoader
      );
      thread.startThread();
      this.ModLoader.logger.info(
        'client: Saving custom equipment model(s) for player ' +
        packet.player.nickname +
        '.'
      );
    }
  }

  @NetworkHandler('Ooto_IconAllocatePacket')
  onIconAllocateClient(packet: Ooto_IconAllocatePacket) {
    if (
      !this.clientStorage.playerModelCache.hasOwnProperty(packet.player.uuid)
    ) {
      this.clientStorage.playerModelCache[packet.player.uuid] = new ModelPlayer(packet.player.uuid);
    }
    if (packet.age === Age.ADULT) {
      (this.clientStorage.playerModelCache[
        packet.player.uuid
      ] as ModelPlayer).customIconAdult = zlib.inflateSync(packet.icon);
      this.ModLoader.logger.info(
        'client: Saving custom icon for (Adult) player ' +
        packet.player.nickname +
        '.'
      );
    }
    if (packet.age === Age.CHILD) {
      (this.clientStorage.playerModelCache[
        packet.player.uuid
      ] as ModelPlayer).customIconChild = zlib.inflateSync(packet.icon);
      this.ModLoader.logger.info(
        'client: Saving custom icon for (Child) player ' +
        packet.player.nickname +
        '.'
      );
    }
  }

  @EventHandler(EventsClient.ON_PLAYER_LEAVE)
  onPlayerLeft(player: INetworkPlayer) {
    delete this.clientStorage.playerModelCache[player.uuid];
    if (this.allocationManager.isPlayerAllocated(player)) {
      this.allocationManager.deallocateSlot(
        this.allocationManager.getModelIndex(
          this.allocationManager.getPlayerAllocation(player)
        )
      );
    }
    this.ModLoader.logger.info(this.allocationManager.getAvailableSlots() + " model blocks left!");
  }

  @NetworkHandler("OotO_GiveModelPacket")
  onPlayerJoin_client(packet: OotO_GiveModelPacket) {
    if (packet.target.uuid !== this.ModLoader.me.uuid) {
      if (this.customModelFileAdult !== '') {
        let def = zlib.deflateSync(this.clientStorage.adultModel);
        this.ModLoader.clientSide.sendPacketToSpecificPlayer(
          new Ooto_AllocateModelPacket(
            def,
            Age.ADULT,
            this.ModLoader.clientLobby,
            this.ModLoader.utils.hashBuffer(def)
          ), packet.target
        );
      }

      if (this.customModelFileChild !== '') {
        let def = zlib.deflateSync(this.clientStorage.childModel);
        this.ModLoader.clientSide.sendPacketToSpecificPlayer(
          new Ooto_AllocateModelPacket(
            def,
            Age.CHILD,
            this.ModLoader.clientLobby,
            this.ModLoader.utils.hashBuffer(def)
          ),
          packet.target
        );
      }

      if (this.customModelFileEquipment !== '') {
        let def = zlib.deflateSync(this.clientStorage.equipmentModel);
        this.ModLoader.clientSide.sendPacketToSpecificPlayer(
          new Ooto_AllocateModelPacket(
            def,
            0x69,
            this.ModLoader.clientLobby,
            this.ModLoader.utils.hashBuffer(def)
          ),
          packet.target
        );
      }

      if (this.customModelFileAdultIcon !== '') {
        let def = zlib.deflateSync(this.clientStorage.adultIcon);
        this.ModLoader.clientSide.sendPacketToSpecificPlayer(
          new Ooto_IconAllocatePacket(
            def,
            Age.ADULT,
            this.ModLoader.clientLobby,
            this.ModLoader.utils.hashBuffer(def)
          ),
          packet.target
        );
      }

      if (this.customModelFileChildIcon !== '') {
        let def = zlib.deflateSync(this.clientStorage.childIcon);
        this.ModLoader.clientSide.sendPacketToSpecificPlayer(
          new Ooto_IconAllocatePacket(
            def,
            Age.CHILD,
            this.ModLoader.clientLobby,
            this.ModLoader.utils.hashBuffer(def)
          ),
          packet.target
        );
      }
    }
  }

  @EventHandler("OotOnline:WriteDefaultPuppetZobjs")
  onWriteRequest(evt: any) {
    this.ModLoader.logger.debug("Writing default models...");
    this.ModLoader.emulator.rdramWriteBuffer(
      0x800000,
      this.allocationManager.getModelInSlot(0).model.adult.zobj
    );
    this.ModLoader.emulator.rdramWriteBuffer(
      0x837800,
      this.allocationManager.getModelInSlot(1).model.child.zobj
    );
  }

  @EventHandler(OotOnlineEvents.PLAYER_PUPPET_PRESPAWN)
  onPuppetPreSpawn(puppet: Puppet) {
    let puppet_spawn_params_ptr: number = 0x80600140;
    let puppet_spawn_variable_offset: number = 0xE;
    this.ModLoader.emulator.rdramWriteBuffer(
      0x800000,
      this.allocationManager.getModelInSlot(0).model.adult.zobj
    );
    this.ModLoader.emulator.rdramWriteBuffer(
      0x837800,
      this.allocationManager.getModelInSlot(1).model.child.zobj
    );
    this.ModLoader.emulator.rdramWritePtr16(puppet_spawn_params_ptr, puppet_spawn_variable_offset, puppet.age);
    if (
      !this.clientStorage.playerModelCache.hasOwnProperty(puppet.player.uuid)
    ) {
      return;
    }
    if (!this.allocationManager.isPlayerAllocated(puppet.player)) {
      let slot = this.allocationManager.allocateSlot((this.clientStorage.playerModelCache[puppet.player.uuid] as ModelPlayer));
      this.ModLoader.logger.info("Trying to allocate model block " + slot + ".");
      this.ModLoader.logger.info(this.allocationManager.getAvailableSlots() + " model blocks left!");
    }
    this.ModLoader.logger.info("Getting model for player " + puppet.player.nickname + "...");
    let model: ModelPlayer = this.allocationManager.getPlayerAllocation(
      puppet.player
    );
    let index: number = this.allocationManager.getModelIndex(model);
    this.ModLoader.logger.info("This model is assigned to model block " + index + ".");
    let allocation_size = 0x37800;
    let addr: number = 0x800000 + allocation_size * index;
    this.ModLoader.logger.info("Model block " + index + " starts at address 0x" + addr.toString(16) + ".");
    let zobj_size: number = allocation_size;
    let passed: boolean = false;
    if (puppet.age === Age.ADULT && model.model.adult !== undefined) {
      if (model.model.adult.zobj.byteLength > 1) {
        this.ModLoader.logger.info("Writing adult model into model block " + index + ".");
        this.ModLoader.emulator.rdramWriteBuffer(
          addr,
          new zzstatic().doRepoint(model.model.adult.zobj, index)
        );
        zobj_size = model.model.adult.zobj.byteLength;
        passed = true;
      }
    }
    if (puppet.age === Age.CHILD && model.model.child !== undefined) {
      if (model.model.child.zobj.byteLength > 1) {
        this.ModLoader.logger.info("Writing child model into model block " + index + ".");
        this.ModLoader.emulator.rdramWriteBuffer(
          addr,
          new zzstatic().doRepoint(model.model.child.zobj, index)
        );
        zobj_size = model.model.child.zobj.byteLength;
        passed = true;
      }
    }
    if (model.model.equipment !== undefined) {
      if (model.model.equipment.zobj.byteLength > 1) {
        if (puppet.age === Age.ADULT && model.model.adult.zobj.byteLength <= 1) {
          let adult_model: Buffer = fs.readFileSync(path.join(this.cacheDir, "adult.zobj"));
          zobj_size = adult_model.byteLength;
          this.ModLoader.emulator.rdramWriteBuffer(addr, new zzstatic().doRepoint(adult_model, index));
          passed = true;
        }
        if (puppet.age === Age.CHILD && model.model.child.zobj.byteLength <= 1) {
          let child_model: Buffer = fs.readFileSync(path.join(this.cacheDir, "child.zobj"));
          zobj_size = child_model.byteLength;
          this.ModLoader.emulator.rdramWriteBuffer(addr, new zzstatic().doRepoint(child_model, index));
          passed = true;
        }
        if ((zobj_size + (model.model.equipment.zobj.byteLength - 0x800)) < allocation_size) {
          let zobj: Buffer = new zzstatic().doRepoint(model.model.equipment.zobj, 0, false, 0x80000000 + addr + zobj_size - 0x800);
          this.ModLoader.emulator.rdramWriteBuffer(
            addr + zobj_size,
            zobj.slice(0x800)
          );
          let metaSize: number = model.model.equipment.zobj.readUInt32BE(0xC);
          let temp_equipmentMetadata: any = {};
          temp_equipmentMetadata = JSON.parse(model.model.equipment.zobj.slice(0x310, 0x310 + metaSize).toString());
          Object.keys(temp_equipmentMetadata).forEach((key: string) => {
            if (this.equipmentAdultMap.has(key) || this.equipmentChildMap.has(key)) {
              this.ModLoader.logger.info("Loading dlist replacement for " + key + ".");
              if (puppet.age === Age.ADULT) {
                if (this.equipmentAdultMap.has(key)) {
                  for (let i = 0; i < this.equipmentAdultMap.get(key)!.length; i++) {
                    this.ModLoader.emulator.rdramWrite32(addr + this.equipmentAdultMap.get(key)![i] + 0x4, zobj.readUInt32BE(temp_equipmentMetadata[key] + 0x4));
                  }
                }
              } else if (puppet.age === Age.CHILD) {
                if (this.equipmentChildMap.has(key)) {
                  for (let i = 0; i < this.equipmentChildMap.get(key)!.length; i++) {
                    this.ModLoader.emulator.rdramWrite32(addr + this.equipmentChildMap.get(key)![i] + 0x4, zobj.readUInt32BE(temp_equipmentMetadata[key] + 0x4));
                  }
                }
              }
            }
          });
        } else {
          this.ModLoader.logger.warn("Can't allocate equipment zobj in slot " + index + "!");
        }
      }
    }
    if (passed) {
      this.ModLoader.emulator.rdramWritePtr16(puppet_spawn_params_ptr, puppet_spawn_variable_offset, index);
    }
  }

  @EventHandler(OotEvents.ON_SCENE_CHANGE)
  onSceneChange(scene: number) {
    this.ModLoader.emulator.rdramWriteBuffer(
      0x800000,
      this.allocationManager.getModelInSlot(0).model.adult.zobj
    );
    this.ModLoader.emulator.rdramWriteBuffer(
      0x837800,
      this.allocationManager.getModelInSlot(1).model.child.zobj
    );
  }

  @EventHandler(EventsClient.ON_INJECT_FINISHED)
  onLoaded(evt: any) {
    this.ModLoader.emulator.rdramWriteBuffer(
      0x800000,
      this.allocationManager.getModelInSlot(0).model.adult.zobj
    );
    this.ModLoader.emulator.rdramWriteBuffer(
      0x837800,
      this.allocationManager.getModelInSlot(1).model.child.zobj
    );
  }
}