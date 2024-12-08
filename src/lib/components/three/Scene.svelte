<script lang="ts">
  import { T } from '@threlte/core';
  //  Float, Grid,
  import { ContactShadows, OrbitControls, Grid } from '@threlte/extras';

  // import Tree from '$lib/components/TreeO1.svelte';
</script>

<T.PerspectiveCamera makeDefault position={[-10, 10, 10]} fov={20}>
  <OrbitControls enableDamping target.y={0.25} minDistance={10} maxDistance={30} />
</T.PerspectiveCamera>

<T.DirectionalLight intensity={0.8} position.x={5} position.y={10} />
<T.AmbientLight intensity={0.2} />

<Grid
  position.y={-0.001}
  cellColor="#ffffff"
  sectionColor="#ffffff"
  sectionThickness={0}
  fadeDistance={38}
  gridSize={52}
  cellSize={2}
/>

<ContactShadows scale={10} blur={2} far={2.5} opacity={0.5} />
<T.Mesh position.y={1.2} position.z={-0.75}>
  <T.BoxGeometry />
  <T.MeshStandardMaterial color="#0059BA" />
</T.Mesh>

<T.Mesh position={[1.2, 1.5, 0.75]} rotation.x={5} rotation.y={71}>
  <T.TorusKnotGeometry args={[0.5, 0.15, 100, 12, 2, 3]} />
  <T.MeshStandardMaterial color="#F85122" />
</T.Mesh>
<T.Mesh position={[-1.4, 1.5, 0.75]} rotation={[-5, 128, 10]}>
  <T.IcosahedronGeometry />
  <T.MeshStandardMaterial color="#F8EBCE" />
</T.Mesh>

<!-- Our new Tree component -->
<!--<Tree-->
<!--	position={[0, 0, 0]}-->
<!--	trunkHeight={2}-->
<!--	trunkRadius={0.15}-->
<!--	leafColor="#3BAF29"-->
<!--	branchCount={4}-->
<!--	bushCount={5}-->
<!--	bushColor="#4CA64C"-->
<!--	bushSize={0.3}-->
<!--/>-->
