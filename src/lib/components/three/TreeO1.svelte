<script lang="ts">
  import { T } from '@threlte/core';
  import * as THREE from 'three';

  // Trunk parameters
  export let trunkHeight = 3;
  export let trunkBottomRadius = 0.4;
  export let trunkTopRadius = 0.2;
  export let trunkSegments = 4;
  export let trunkColor = '#8B5A2B';

  // Branch parameters
  export let branchCount = 4;
  export let branchLength = 1.0; // Shorter branches
  export let branchRadius = 0.1;
  export let branchColor = trunkColor;

  // Leaves parameters
  export let leafColor = '#3BAF29';
  export let leafSize = 0.25;
  export let leavesPerCluster = 3;
  export let leafSpread = 0.05; // tight clusters
  export let branchLayers = 2; // number of leaf clusters along the branch length

  /**
   * We'll distribute branches evenly around the trunk.
   * Branches start between 30% and 80% of trunk height.
   * Slightly tilt them upwards and shorter so they don't look too big.
   */
  const branchBaseOffset = trunkBottomRadius * 0.8;

  let branches = [];
  for (let i = 0; i < branchCount; i++) {
    const height = THREE.MathUtils.lerp(
      trunkHeight * 0.3,
      trunkHeight * 0.8,
      i / (branchCount - 1),
    );
    const angle = i * ((2 * Math.PI) / branchCount) + Math.PI / 4;
    branches.push({ height, angle });
  }
</script>

<T.Group>
  <!-- Trunk -->
  <T.Mesh position={[0, trunkHeight / 2, 0]} rotation={[0, 0.2, 0]}>
    <T.CylinderGeometry
      args={[trunkBottomRadius, trunkTopRadius, trunkHeight, trunkSegments]}
    />
    <T.MeshStandardMaterial
      color={trunkColor}
      roughness={1}
      flatShading={true}
      metalness={0}
    />
  </T.Mesh>

  <!-- Branches with multiple leaf clusters -->
  {#each branches as branch}
    <!-- Rotate around trunk for angle -->
    <T.Group rotation={[0, branch.angle, 0]}>
      <!-- Slight upward tilt: rotateZ by a negative angle to lift branch tip upward -->
      <!-- Position branch so it extends from trunk outward along X -->
      <T.Group rotation={[0, 0, -0.3]}>
        <T.Mesh
          position={[branchBaseOffset + branchLength / 2, branch.height, 0]}
        >
          <T.BoxGeometry
            args={[branchLength, branchRadius * 2, branchRadius * 2]}
          />
          <T.MeshStandardMaterial
            color={branchColor}
            roughness={1}
            flatShading={true}
            metalness={0}
          />
        </T.Mesh>

        <!-- Leaves along the branch -->
        <!-- We place branchLayers clusters along the branch's length -->
        <!-- For each layer, we place a cluster of leaves slightly above (in y) -->
        {#each Array(branchLayers) as _, layerIndex}
          {@const layerFraction = (layerIndex + 1) / (branchLayers + 1)}
          <!-- Position of this leaf cluster along the branch -->
          <!-- The branch runs from branchBaseOffset to branchBaseOffset+branchLength -->
          <!-- So cluster position along X: branchBaseOffset + branchLength * layerFraction -->
          <!-- We'll add a slight upward offset in Y to place leaves above the branch surface -->
          <!-- Also, reduce X slightly so leaves overlap branch a bit -->
          <T.Group
            position={[
              branchBaseOffset + branchLength * layerFraction,
              branch.height + branchRadius * 1.5, // raise leaves above branch a bit
              0,
            ]}
          >
            {#each Array(leavesPerCluster) as _, li}
              {@const angle = ((2 * Math.PI) / leavesPerCluster) * li}
              <T.Mesh
                position={[
                  Math.cos(angle) * leafSpread,
                  0,
                  Math.sin(angle) * leafSpread,
                ]}
              >
                <T.IcosahedronGeometry args={[leafSize, 0]} />
                <T.MeshStandardMaterial
                  color={leafColor}
                  roughness={1}
                  flatShading={true}
                  metalness={0}
                />
              </T.Mesh>
            {/each}
          </T.Group>
        {/each}

        <!-- Add a cluster at the branch tip as well (optional) -->
        <T.Group
          position={[
            branchBaseOffset + branchLength - leafSize * 0.1,
            branch.height + branchRadius * 1.5,
            0,
          ]}
        >
          {#each Array(leavesPerCluster) as _, li}
            {@const angle = ((2 * Math.PI) / leavesPerCluster) * li}
            <T.Mesh
              position={[
                Math.cos(angle) * leafSpread,
                0,
                Math.sin(angle) * leafSpread,
              ]}
            >
              <T.IcosahedronGeometry args={[leafSize, 0]} />
              <T.MeshStandardMaterial
                color={leafColor}
                roughness={1}
                flatShading={true}
                metalness={0}
              />
            </T.Mesh>
          {/each}
        </T.Group>
      </T.Group>
    </T.Group>
  {/each}

  <!-- Top leaves at the trunk apex -->
  <T.Group position={[0, trunkHeight - leafSize * 0.3, 0]}>
    <T.Mesh>
      <T.IcosahedronGeometry args={[leafSize * 2, 0]} />
      <T.MeshStandardMaterial
        color={leafColor}
        roughness={1}
        flatShading={true}
        metalness={0}
      />
    </T.Mesh>

    {#each Array(4) as _, i}
      {@const angle = ((2 * Math.PI) / 4) * i}
      <T.Mesh
        position={[
          Math.cos(angle) * (leafSpread * 2),
          leafSize * 0.5,
          Math.sin(angle) * (leafSpread * 2),
        ]}
      >
        <T.IcosahedronGeometry args={[leafSize, 0]} />
        <T.MeshStandardMaterial
          color={leafColor}
          roughness={1}
          flatShading={true}
          metalness={0}
        />
      </T.Mesh>
    {/each}
  </T.Group>
</T.Group>
